#!/usr/bin/env node

/**
 * Validates authentication boundary rules in the LTE project.
 * Ensures auth-related calls are restricted to defined modules and files.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const DIRECTORIES_TO_CHECK = ["src", "functions"];
const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "__tests__",
  "__mocks__",
];

// Approved paths for rule checks
const APPROVED_SSO_SERVICE_FILES = [
  "functions/lib/sso-client.ts",
  "functions/lib/env.ts",
  "functions/lib/types.ts",
  "functions/shared/types.ts",
  "functions/middleware/auth.ts",
];

const APPROVED_FRONTEND_AUTH_FILES = [
  "src/shared/api/authApi.ts",
];

const APPROVED_AUTH_FILENAME_PATHS = [
  "src/entities/session",
  "src/shared/api/authApi.ts",
  "src/shared/types/auth.ts",
  "functions/lib/auth.ts",
  "functions/lib/sso-client.ts",
  "functions/middleware/auth.ts",
  "functions/api/v1/auth",
];

async function getFiles(dir, allFiles = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(process.cwd(), fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      const isExcluded = entry.name.startsWith(".") || EXCLUDED_DIRS.includes(entry.name);
      if (!isExcluded) {
        await getFiles(fullPath, allFiles);
      }
    } else if (entry.isFile()) {
      const ext = entry.name.substring(entry.name.lastIndexOf("."));
      const isTestFile = entry.name.includes(".test.") || entry.name.includes(".spec.");

      if ([".ts", ".tsx"].includes(ext) && !isTestFile) {
        allFiles.push(relativePath);
      }
    }
  }
  return allFiles;
}

async function validateAuthCalls() {
  const violations = [];
  const files = [];

  for (const dir of DIRECTORIES_TO_CHECK) {
    try {
      await getFiles(dir, files);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(`Error scanning ${dir}/: ${error.message}`);
      }
    }
  }

  for (const file of files) {
    let content = "";
    try {
      content = await readFile(file, "utf-8");
    } catch (error) {
      console.error(`Error reading ${file}: ${error.message}`);
      continue;
    }

    const lines = content.split("\n");

    // Rule 1: Direct SSO_SERVICE reference check
    if (content.includes("SSO_SERVICE")) {
      const isApproved = APPROVED_SSO_SERVICE_FILES.includes(file) || file.startsWith("functions/api/v1/auth/");
      if (!isApproved) {
        for (let idx = 0; idx < lines.length; idx++) {
          if (lines[idx].includes("SSO_SERVICE")) {
            violations.push({
              file,
              line: idx + 1,
              rule: "Rule 1: Direct SSO_SERVICE Binding Usage Restricted",
              message: "Directly referencing SSO_SERVICE is prohibited outside authorized sso-client and configuration files.",
              snippet: lines[idx].trim(),
            });
          }
        }
      }
    }

    // Rule 2: Direct Frontend Auth API route references
    if (file.startsWith("src/")) {
      const containsAuthPath = 
        content.includes("/api/v1/auth") || 
        /`\/api\/v1\/auth/i.test(content);

      if (containsAuthPath) {
        const isApproved = APPROVED_FRONTEND_AUTH_FILES.includes(file);
        if (!isApproved) {
          for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            if (line.includes("/api/v1/auth") || /`\/api\/v1\/auth/i.test(line)) {
              violations.push({
                file,
                line: idx + 1,
                rule: "Rule 2: Direct Frontend Auth HTTP Calls Restricted",
                message: `Directly fetching or referencing auth endpoints is prohibited outside approved file: ${APPROVED_FRONTEND_AUTH_FILES.join(", ")}`,
                snippet: line.trim(),
              });
            }
          }
        }
      }
    }

    // Rule 3: Enforce withAuth instead of requireAuth on backend route controllers
    if (file.startsWith("functions/api/") && !file.startsWith("functions/api/v1/auth/")) {
      if (content.includes("requireAuth")) {
        for (let idx = 0; idx < lines.length; idx++) {
          if (lines[idx].includes("requireAuth")) {
            violations.push({
              file,
              line: idx + 1,
              rule: "Rule 3: Enforce withAuth Middleware",
              message: "Use withAuth middleware wrapping instead of requireAuth function calls in API route controllers.",
              snippet: lines[idx].trim(),
            });
          }
        }
      }
    }

    // Rule 4: No creation of external auth/sso files outside approved locations
    const filenameLower = file.toLowerCase();
    const hasAuthInName = filenameLower.includes("auth") || filenameLower.includes("sso");
    if (hasAuthInName) {
      const isApprovedPath = APPROVED_AUTH_FILENAME_PATHS.some((approvedPath) => {
        return file.startsWith(approvedPath);
      });
      if (!isApprovedPath) {
        violations.push({
          file,
          line: 1,
          rule: "Rule 4: External Auth File Creation Prohibited",
          message: `Auth-related files containing 'auth' or 'sso' in their name must not reside outside approved auth modules (${APPROVED_AUTH_FILENAME_PATHS.join(", ")}).`,
          snippet: `Filename: ${file}`,
        });
      }
    }
  }

  return violations;
}

async function main() {
  console.log("Analyzing auth call boundaries inside LTE codebase...\n");

  const violations = await validateAuthCalls();

  if (violations.length === 0) {
    console.log("✅ Check Complete: No authentication boundary violations found.\n");
    process.exit(0);
  }

  console.error(`❌ Found ${violations.length} boundary violation(s):\n`);

  const grouped = {};
  for (const v of violations) {
    if (!grouped[v.file]) {
      grouped[v.file] = [];
    }
    grouped[v.file].push(v);
  }

  for (const [file, items] of Object.entries(grouped)) {
    console.error(`File: ${file}`);
    for (const item of items) {
      console.error(`   [Line ${item.line}] [${item.rule}]`);
      console.error(`   Message: ${item.message}`);
      console.error(`   Code:    ${item.snippet}`);
      console.error("");
    }
  }

  process.exit(1);
}

main().catch((error) => {
  console.error("Error running validation script:", error);
  process.exit(1);
});
