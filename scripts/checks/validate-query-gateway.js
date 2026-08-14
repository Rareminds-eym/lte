#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { collectFiles } from "../lib/walker.js";

const config = JSON.parse(
  readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"),
);
const { excludedDirs } = config;

const USER_OWNED_TABLES = new Set([
  "artifact_submissions",
  "learning_paths",
  "learning_tracks",
  "user_capabilities",
  "user_capability_level_progress",
  "user_module_progress",
  "user_profiles",
  "user_stage_progress",
  "xp_events",
]);

const RAW_SUPABASE_INTERNALS = [
  "functions/lib/supabase.ts",
  "functions/lib/query-gateway/gateway.ts",
  "functions/lib/query-gateway/service.ts",
  "functions/lib/query-gateway/types.ts",
];

const ROUTE_EXPORT_PATTERN = /export\s+async\s+function\s+onRequest(?:Get|Post|Patch|Put|Delete)\b/;
const RAW_SUPABASE_CONTEXT_PATTERN =
  /from\s+["']@supabase\/supabase-js["']|SupabaseClient|createServiceSupabase\s*\(|\bsupabase\s*:/;
const RAW_FROM_LINE_PATTERN = /\b(?:supabase|client|db)\.from\s*\(|^\s*\.from\s*\(/;
const GATEWAY_OPERATION_PATTERN = /\b(?:qb|gateway)\.(read|insert|update|delete|upsert|rpc)\s*\(/g;
const POLICY_PATTERN =
  /(?:const|export\s+const)\s+(\w+Policy)\s*=\s*\{[\s\S]*?\n\}\s+as\s+const/g;
const DB_BACKED_ROUTE_SIGNAL =
  /@functions\/lib\/query-gateway|@functions\/lib\/supabase|QueryGateway|createServiceSupabase|createServiceQueryGateway|\.from\s*\(|\bqb\.(?:read|insert|update|delete|upsert|rpc)\s*\(/;

function isProductionFile(file) {
  return (
    file.endsWith(".ts") &&
    !file.includes("/__tests__/") &&
    !file.includes("/__mocks__/") &&
    !file.includes(".test.") &&
    !file.includes(".spec.")
  );
}

function isRawSupabaseInternal(file) {
  return RAW_SUPABASE_INTERNALS.includes(file);
}

function lineNumberFor(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function getLine(content, lineNumber) {
  return content.split(/\r?\n/)[lineNumber - 1]?.trim() ?? "";
}

function addFinding(findings, content, index, rule, message) {
  const line = lineNumberFor(content, index);
  findings.push({
    line,
    rule,
    message,
    code: getLine(content, line),
  });
}

function extractStringProperty(block, property) {
  const match = new RegExp(`${property}\\s*:\\s*["']([^"']+)["']`).exec(block);
  return match?.[1] ?? null;
}

function hasOwnership(block) {
  return /\bownership\s*:/.test(block);
}

function hasUserIdPolicySurface(block) {
  return /\bfilters\s*:\s*\[[\s\S]*?["']user_id["']/.test(block) ||
    /\b(?:insertColumns|updateColumns|upsertColumns)\s*:\s*\[[\s\S]*?["']user_id["']/.test(block);
}

function printGroupedFindings(title, findingsByFile) {
  const entries = [...findingsByFile.entries()].filter(([, findings]) => findings.length > 0);
  console.log(`\n${title}`);
  if (entries.length === 0) {
    console.log("  none");
    return;
  }

  for (const [file, findings] of entries) {
    console.log(`\n  File: ${file}`);
    for (const finding of findings) {
      console.log(`    [Line ${finding.line}] ${finding.rule}`);
      console.log(`    ${finding.message}`);
      if (finding.code) console.log(`    Code: ${finding.code}`);
    }
  }
}

async function main() {
  const files = (
    await collectFiles(["functions"], {
      excludedDirs,
      extensions: [".ts"],
      excludeTests: true,
    })
  ).filter(isProductionFile);

  const rawFindingsByFile = new Map();
  const warningFindingsByFile = new Map();
  const operationCounts = {
    read: 0,
    insert: 0,
    update: 0,
    delete: 0,
    upsert: 0,
    rpc: 0,
  };

  let routeFiles = 0;
  let routeFilesWithGateway = 0;
  let policyCount = 0;
  let ownershipPolicyCount = 0;

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const rawFindings = [];
    const warnings = [];
    const rawAllowed = isRawSupabaseInternal(file);

    if (file.startsWith("functions/api/") && ROUTE_EXPORT_PATTERN.test(content)) {
      routeFiles += 1;
      if (/createServiceQueryGateway\s*\(/.test(content)) {
        routeFilesWithGateway += 1;
      } else if (
        /qb\.(?:read|insert|update|delete|upsert|rpc)\s*\(/.test(content) ||
        /QueryGateway/.test(content)
      ) {
        routeFilesWithGateway += 1;
      } else if (DB_BACKED_ROUTE_SIGNAL.test(content)) {
        warnings.push({
          line: 1,
          rule: "Gateway route entry not detected",
          message:
            "Route does not visibly create or receive a query gateway. This may be fine for pure validation/proxy routes, but DB-backed routes should use createServiceQueryGateway(context.env).",
          code: "",
        });
      }
    }

    for (const match of content.matchAll(/from\s+["']@functions\/lib\/supabase["']/g)) {
      if (!rawAllowed) {
        addFinding(
          rawFindings,
          content,
          match.index ?? 0,
          "Direct service Supabase import",
          "Production backend code should use the query gateway boundary instead of importing the raw service Supabase helper.",
        );
      }
    }

    for (const match of content.matchAll(/createServiceSupabase\s*\(/g)) {
      if (!rawAllowed) {
        addFinding(
          rawFindings,
          content,
          match.index ?? 0,
          "Direct service Supabase creation",
          "Use createServiceQueryGateway(context.env) in routes, then pass qb/source into helpers.",
        );
      }
    }

    for (const match of content.matchAll(/from\s+["']@supabase\/supabase-js["']/g)) {
      if (!rawAllowed) {
        addFinding(
          rawFindings,
          content,
          match.index ?? 0,
          "Supabase SDK import",
          "Migrated backend code should depend on QueryGateway or QueryGatewaySource types instead of SupabaseClient.",
        );
      }
    }

    if (!rawAllowed && RAW_SUPABASE_CONTEXT_PATTERN.test(content)) {
      let lineStartIndex = 0;
      for (const line of content.split(/\r?\n/)) {
        if (RAW_FROM_LINE_PATTERN.test(line)) {
          addFinding(
            rawFindings,
            content,
            lineStartIndex,
            "Raw Supabase query",
            "Use qb.read/qb.insert/qb.update/qb.delete/qb.upsert/qb.rpc with backend-defined policies.",
          );
        }
        lineStartIndex += line.length + 1;
      }
    }

    for (const match of content.matchAll(GATEWAY_OPERATION_PATTERN)) {
      const operation = match[1];
      if (operation in operationCounts) operationCounts[operation] += 1;
    }

    for (const match of content.matchAll(POLICY_PATTERN)) {
      const [, policyName] = match;
      const block = match[0];
      policyCount += 1;

      const table = extractStringProperty(block, "table");
      const operation = extractStringProperty(block, "operation");
      if (hasOwnership(block)) ownershipPolicyCount += 1;

      if (
        USER_OWNED_TABLES.has(table) &&
        operation !== "rpc" &&
        !hasOwnership(block) &&
        hasUserIdPolicySurface(block)
      ) {
        addFinding(
          warnings,
          content,
          match.index ?? 0,
          "User-owned policy missing ownership",
          `${policyName} targets user-owned table "${table}" but does not define ownership. Confirm this is intentionally backend-scoped.`,
        );
      }
    }

    if (rawFindings.length > 0) rawFindingsByFile.set(file, rawFindings);
    if (warnings.length > 0) warningFindingsByFile.set(file, warnings);
  }

  const rawViolationCount = [...rawFindingsByFile.values()].reduce(
    (sum, findings) => sum + findings.length,
    0,
  );
  const warningCount = [...warningFindingsByFile.values()].reduce(
    (sum, findings) => sum + findings.length,
    0,
  );

  console.log("Query Gateway Boundary Audit\n");
  console.log(`Files checked: ${files.length}`);
  console.log(`API route files checked: ${routeFiles}`);
  console.log(`API route files with gateway signal: ${routeFilesWithGateway}`);
  console.log(`Policy objects checked: ${policyCount}`);
  console.log(`Policies with ownership: ${ownershipPolicyCount}`);
  console.log(`Raw Supabase violations: ${rawViolationCount}`);
  console.log(`Warnings: ${warningCount}`);

  console.log("\nGateway operations observed:");
  for (const [operation, count] of Object.entries(operationCounts)) {
    console.log(`  ${operation}: ${count}`);
  }

  printGroupedFindings("Raw Supabase Violations", rawFindingsByFile);
  printGroupedFindings("Gateway Review Warnings", warningFindingsByFile);

  console.log(
    "\nAudit mode only: this script reports gateway migration status and does not enforce CI failure yet.",
  );
}

main().catch((error) => {
  console.error("Error running query gateway audit:", error);
  process.exit(1);
});
