#!/usr/bin/env node

import { collectFiles, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

// Load configuration
const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".json", ".md", ".wasm", ".css"];
const DIRECTORIES_TO_CHECK = ["src", "functions"];

async function main() {
  // Use collectFiles with excludeTests: false so we check all file types, even in test folders
  const allFiles = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    excludeTests: false,
  });

  const violations = [];
  for (const file of allFiles) {
    const ext = file.substring(file.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      violations.push({
        file,
        line: 1,
        message: `File type not allowed: ${ext}. Only .ts, .tsx, .json, .md, .css, and .wasm files are permitted.`,
      });
    }
  }

  reportFindings(violations, {
    headline: "Validating file types (only approved extensions allowed in src/ and functions/)...",
    tip: "Rename or remove unapproved file types inside code folders.",
  });
}

main().catch((error) => {
  console.error("Error running file types validation:", error);
  process.exit(1);
});
