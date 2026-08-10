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
    // Check frontend files
    if (file.startsWith("src/")) {
      const hasBackendImport = 
        line.includes("@functions/") || 
        line.includes("from \"functions/") || 
        line.includes("from 'functions/") ||
        /from\s+["'](\.\.\/)+functions(?:\/|["'])/.test(line);

      if (hasBackendImport) {
        return {
          rule: "Architecture: Runtime separation violation",
          message: "Frontend code inside 'src/' must never import backend code or types from 'functions/'.",
        };
      }
    }

    // Check backend files
    if (file.startsWith("functions/")) {
      const hasFrontendImport = 
        line.includes("from \"@/") || 
        line.includes("from '@/") || 
        line.includes("from \"src/") || 
        line.includes("from 'src/") ||
        /from\s+["'](\.\.\/)+src(?:\/|["'])/.test(line);

      if (hasFrontendImport) {
        return {
          rule: "Architecture: Runtime separation violation",
          message: "Backend code inside 'functions/' must never import frontend code or types from 'src/'.",
        };
      }
    }

    return null;
  });

  reportFindings(violations, {
    headline: "Validating frontend-backend runtime isolation...",
    tip: "Use HTTP API endpoints or separate shared npm packages for communications and types crossing boundaries.",
  });
}

main().catch((error) => {
  console.error("Error running runtime separation validation:", error);
  process.exit(1);
});
