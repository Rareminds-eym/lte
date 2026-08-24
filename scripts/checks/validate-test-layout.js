#!/usr/bin/env node

import { collectFiles, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["src"];
const ALLOWED_TESTS_SUB_SEGMENTS = ["api", "guards", "pages", "store", "components", "hooks", "layouts", "widgets", "ui", "shell", "app", "errors", "navigation"];

async function main() {
  // Collect only test files
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    excludeTests: false, // We want tests!
  });

  const testFiles = files.filter((file) => file.includes(".test.") || file.includes(".spec."));
  const violations = [];

  for (const file of testFiles) {
    const parts = file.split("/"); // e.g. ["src", "__tests__", "dashboard", "api", "dashboardApi.test.ts"]
    
    // We only care about tests nested inside __tests__
    const testsIndex = parts.indexOf("__tests__");
    if (testsIndex === -1) continue;

    // Remaining parts after __tests__, e.g., ["dashboard", "api", "dashboardApi.test.ts"]
    const relParts = parts.slice(testsIndex + 1);

    // 1. Flag test files directly under __tests__
    if (relParts.length === 1) {
      violations.push({
        file,
        line: 1,
        rule: "Testing: Flat test layout violation",
        message: "Test files must not be placed directly under the '__tests__' root. Organize them by feature slice.",
      });
      continue;
    }

    // 2. Flag test files directly under a slice without a sub-segment (e.g. __tests__/dashboard/dashboardApi.test.ts)
    if (relParts.length === 2) {
      violations.push({
        file,
        line: 1,
        rule: "Testing: Missing responsibility segment",
        message: `Test files under slice '${relParts[0]}' must be nested under a responsibility sub-folder (e.g. 'components', 'api', 'pages', 'hooks').`,
      });
      continue;
    }

    // 3. Optional segment check: ensure the sub-segment is approved
    const subSegment = relParts[1];
    if (!ALLOWED_TESTS_SUB_SEGMENTS.includes(subSegment)) {
      violations.push({
        file,
        line: 1,
        rule: "Testing: Unapproved responsibility segment",
        message: `Unapproved test sub-segment '${subSegment}'. Approved responsibility folders: ${ALLOWED_TESTS_SUB_SEGMENTS.join(", ")}.`,
      });
    }
  }

  reportFindings(violations, {
    headline: "Validating test suite directory layout and naming consistency...",
    tip: "Organize test files under sub-folders like src/__tests__/<slice>/<segment>/<test-file>.",
  });
}

main().catch((error) => {
  console.error("Error running test layout validation:", error);
  process.exit(1);
});
