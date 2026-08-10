#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs, allowedFetchFiles } = config;

const DIRECTORIES_TO_CHECK = ["src"];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: true,
  });

  const filesToCheck = files.filter((file) => !allowedFetchFiles.includes(file));

  const violations = await scanLines(filesToCheck, (line, lineNum) => {
    // Check for raw fetch calls, e.g., fetch( or window.fetch( but not in comments
    const hasRawFetch = /\bfetch\s*\(/i.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*");
    if (hasRawFetch) {
      return {
        rule: "Architecture: Raw fetch() call detected",
        message: "Use approved API client wrappers (apiGet, apiPost, etc.) instead of direct fetch() calls.",
      };
    }
    return null;
  });

  reportFindings(violations, {
    headline: "Validating API client wrappers usage on frontend...",
    tip: "Import apiGet, apiPost, etc., from '@/shared/api' to perform backend HTTP requests.",
  });
}

main().catch((error) => {
  console.error("Error running API client validation:", error);
  process.exit(1);
});
