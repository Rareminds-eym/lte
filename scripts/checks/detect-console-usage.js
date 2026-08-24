#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

// Load configuration
const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs, consolePatterns } = config;

const DIRECTORIES_TO_CHECK = ["src", "functions"];
const EXCLUDED_FILES = [
  "src/shared/config/logging.ts",
  "functions/shared/logger.ts",
];

// Compile patterns
const patternRegexes = consolePatterns.map(({ pattern, method }) => ({
  regex: new RegExp(pattern),
  method,
}));

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: true, // We exclude tests from console.log checks
  });

  const filesToCheck = files.filter((file) => !EXCLUDED_FILES.includes(file));

  const violations = await scanLines(filesToCheck, (line, lineNum) => {
    for (const { regex, method } of patternRegexes) {
      if (regex.test(line)) {
        return {
          rule: "No Console Logs in Production",
          message: `Found ${method} statement in production code. Use the centralized logging utility instead.`,
        };
      }
    }
    return null;
  });

  reportFindings(violations, {
    headline: "Scanning for console statements in src/ and functions/...",
    tip: "Use proper logging (logger.debug(), logger.error()) instead of console, or remove console statements.",
  });
}

main().catch((error) => {
  console.error("Error running console usage validation:", error);
  process.exit(1);
});
