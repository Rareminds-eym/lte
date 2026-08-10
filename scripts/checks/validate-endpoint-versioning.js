#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["src", "functions"];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: true,
  });

  const violations = [];

  // Check 1: Backend Route File Locations
  for (const file of files) {
    if (file.startsWith("functions/api/")) {
      if (!file.startsWith("functions/api/v1/")) {
        violations.push({
          file,
          line: 1,
          rule: "Versioning: Endpoint versioning violation",
          message: "API endpoint handler file must reside under versioned directory: 'functions/api/v1/'.",
        });
      }
    }
  }

  // Check 2: Frontend references to unversioned endpoints
  const frontendFiles = files.filter((file) => file.startsWith("src/"));
  const lineViolations = await scanLines(frontendFiles, (line, lineNum) => {
    const isImportOrExport = line.trim().startsWith("import ") || line.trim().startsWith("export ");
    if (isImportOrExport) return null;

    // Look for occurrences of "/api/something" where something is not v1 in string literals
    const unversionedMatch = line.match(/["'`]\/api\/(?![vV]1\/)([a-zA-Z0-9_-]+)/);
    // Ignore external URLs or third-party paths
    const isLocalRequest = unversionedMatch && !line.includes("https://") && !line.includes("http://");

    if (isLocalRequest && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
      return {
        rule: "Versioning: Unversioned request path",
        message: `Frontend request path '${unversionedMatch[0].slice(1)}' must be versioned (e.g., starting with '/api/v1/').`,
      };
    }
    return null;
  });

  violations.push(...lineViolations);

  reportFindings(violations, {
    headline: "Validating API endpoint versioning controls...",
    tip: "Nest backend API files under functions/api/v1/ and prefix API requests with /api/v1/.",
  });
}

main().catch((error) => {
  console.error("Error running endpoint versioning validation:", error);
  process.exit(1);
});
