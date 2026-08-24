#!/usr/bin/env node

import { collectFiles, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Load configuration
const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const MAX_LINES = 1000;
const DIRECTORIES_TO_CHECK = ["src", "functions"];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: false, // We check file lengths of tests too
  });

  const violations = [];
  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const lineCount = content.split(/\r?\n/).length;

      if (lineCount > MAX_LINES) {
        violations.push({
          file,
          line: 1,
          message: `File exceeds maximum length of ${MAX_LINES} lines (currently ${lineCount} lines). Please break down into smaller files.`,
        });
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error.message);
    }
  }

  reportFindings(violations, {
    headline: `Validating file lengths (max ${MAX_LINES} lines for .ts and .tsx files in src/ and functions/)...`,
    tip: "Refactor large files into separate modules/components.",
  });
}

main().catch((error) => {
  console.error("Error running file lengths validation:", error);
  process.exit(1);
});
