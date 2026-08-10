#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["src"];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".tsx"],
    excludeTests: true,
  });

  const violations = await scanLines(files, (line, lineNum) => {
    // Match patterns like text-[#abc], bg-[#123456], etc.
    const match = line.match(/(bg|text|border|ring|shadow|fill|stroke|from|to|via)-\[#([a-fA-F0-9]{3,6})\]/);
    if (match && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
      return {
        rule: "Styling: Arbitrary design token usage",
        message: `Hardcoded color utility '${match[0]}' found. Use global semantic design tokens (e.g. brand-*, surface-*, border-*) instead of hardcoded hex colors.`,
      };
    }
    return null;
  });

  reportFindings(violations, {
    headline: "Scanning for arbitrary hardcoded hex color utilities...",
    tip: "Use standardized semantic Tailwind utility classes rather than ad-hoc hex values.",
  });
}

main().catch((error) => {
  console.error("Error running design token validation:", error);
  process.exit(1);
});
