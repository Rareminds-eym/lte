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

  const violations = await scanLines(files, (line, lineNum, file) => {
    // 1. Check frontend file imports
    if (file.startsWith("src/")) {
      // Flag imports starting with literal "src/"
      const usesLiteralSrc = /from\s+["']src\//.test(line);
      if (usesLiteralSrc) {
        return {
          rule: "Imports: Literal src path detected",
          message: "Use path alias '@/' instead of literal 'src/' path prefix.",
        };
      }

      // Flag deep relative parent directory traversals crossing slice boundaries (e.g. "../../shared" or "../../../entities")
      const usesDeepRelative = /from\s+["']\.\.\/\.\.\//.test(line);
      if (usesDeepRelative) {
        return {
          rule: "Imports: Crossing relative imports",
          message: "Do not use relative parent traversals (../../) across slice boundaries. Use the '@/' path alias instead.",
        };
      }
    }

    // 2. Check backend file imports
    if (file.startsWith("functions/")) {
      // Flag imports starting with literal "functions/"
      const usesLiteralFunctions = /from\s+["']functions\//.test(line);
      if (usesLiteralFunctions) {
        return {
          rule: "Imports: Literal functions path detected",
          message: "Use path alias '@functions/' instead of literal 'functions/' path prefix.",
        };
      }

      // Flag relative traversals crossing slice or boundary limits (e.g. "../../some-lib")
      const usesDeepBackendRelative = /from\s+["']\.\.\/\.\.\//.test(line);
      if (usesDeepBackendRelative) {
        return {
          rule: "Imports: Crossing relative backend imports",
          message: "Do not use relative traversals (../../) to reference other backend folders. Use the '@functions/' path alias instead.",
        };
      }
    }

    return null;
  });

  reportFindings(violations, {
    headline: "Validating path aliases and relative import bounds...",
    tip: "Use the '@/some-slice' path alias for frontend imports and '@functions/some-lib' for backend imports.",
  });
}

main().catch((error) => {
  console.error("Error running import aliases validation:", error);
  process.exit(1);
});