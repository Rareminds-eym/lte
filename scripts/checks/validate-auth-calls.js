#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

// Load configuration
const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs, authModuleFiles, allowedFetchFiles } = config;

const DIRECTORIES_TO_CHECK = ["src", "functions"];

const APPROVED_AUTH_FILENAME_PATHS = [
  "src/entities/session",
  "src/shared/api/authApi.ts",
  "src/shared/types/auth.ts",
  "functions/lib/auth.ts",
  "functions/lib/sso-client.ts",
  "functions/middleware/auth.ts",
  "functions/api/v1/auth",
];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: true, // Test files are ignored for runtime boundary checks
  });

  const violations = [];

  // Check Rule 4: External Auth File Creation Prohibited
  for (const file of files) {
    const filenameLower = file.toLowerCase();
    const hasAuthInName = filenameLower.includes("auth") || filenameLower.includes("sso");
    if (hasAuthInName) {
      const isApprovedPath = APPROVED_AUTH_FILENAME_PATHS.some((approvedPath) => {
        return filenameLower.startsWith(approvedPath.toLowerCase());
      });
      if (!isApprovedPath) {
        violations.push({
          file,
          line: 1,
          rule: "Rule 4: External Auth File Creation Prohibited",
          message: `Auth-related files containing 'auth' or 'sso' in their name must not reside outside approved auth modules.`,
        });
      }
    }
  }

  // Scan lines for Rules 1, 2, and 3
  const lineViolations = await scanLines(files, (line, lineNum, file, content) => {
    // Rule 1: Direct SSO_SERVICE Binding Usage Restricted
    if (line.includes("SSO_SERVICE")) {
      const isApproved = authModuleFiles.includes(file) || file.startsWith("functions/api/v1/auth/") || file === "functions/lib/env.ts" || file === "functions/lib/types.ts";
      if (!isApproved) {
        return {
          rule: "Rule 1: Direct SSO_SERVICE Binding Usage Restricted",
          message: "Directly referencing SSO_SERVICE is prohibited outside authorized sso-client and configuration files.",
        };
      }
    }

    // Rule 2: Direct Frontend Auth HTTP Calls Restricted
    if (file.startsWith("src/")) {
      const isAuthUrl = /(?:fetch|axios|apiFetch)\s*\(\s*["'`]\/api\/v1\/auth/.test(line);
      if (isAuthUrl) {
        const isApproved = allowedFetchFiles.includes(file);
        if (!isApproved) {
          return {
            rule: "Rule 2: Direct Frontend Auth HTTP Calls Restricted",
            message: "Directly fetching or referencing auth endpoints is prohibited outside approved API files.",
          };
        }
      }
    }

    // Rule 3: Enforce withAuth Middleware
    if (file.startsWith("functions/api/") && !file.startsWith("functions/api/v1/auth/")) {
      if (line.includes("requireAuth")) {
        return {
          rule: "Rule 3: Enforce withAuth Middleware",
          message: "Use withAuth middleware wrapping instead of requireAuth function calls in API route controllers.",
        };
      }
    }

    return null;
  });

  violations.push(...lineViolations);

  reportFindings(violations, {
    headline: "Analyzing auth call boundaries inside LTE codebase...",
    tip: "Enforce the withAuth wrapper for backend APIs and direct all auth calls through central auth clients.",
  });
}

main().catch((error) => {
  console.error("Error running auth boundary validation:", error);
  process.exit(1);
});
