#!/usr/bin/env node

import { collectFiles, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs, allowedCatchFiles } = config;

const DIRECTORIES_TO_CHECK = ["src", "functions"];
// Regex to match empty catch blocks (allowing comments/whitespace only)
const EMPTY_CATCH_REGEX = /catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\*[\s\S]*?\*\/|\/\/.*|\s)*\}/g;

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: true,
  });

  const filesToCheck = files.filter((file) => !allowedCatchFiles.includes(file));

  const violations = [];
  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      let match;
      while ((match = EMPTY_CATCH_REGEX.exec(content)) !== null) {
        // Calculate line number
        const charIndex = match.index;
        const lineNum = content.substring(0, charIndex).split("\n").length;
        const snippet = match[0].replace(/\r?\n/g, " ").trim();

        violations.push({
          file,
          line: lineNum,
          rule: "Error-Handling: Empty catch block detected",
          message: "Empty catch blocks are prohibited. Log the error using the centralized logger, or re-throw/return.",
          code: snippet,
        });
      }
    } catch (error) {
      console.error(`Error scanning ${file}:`, error.message);
    }
  }

  reportFindings(violations, {
    headline: "Scanning for empty or silent catch blocks...",
    tip: "Add logger.error(error) or handle the exception appropriately instead of swallowing it silently.",
  });
}

main().catch((error) => {
  console.error("Error running empty catch validation:", error);
  process.exit(1);
});
