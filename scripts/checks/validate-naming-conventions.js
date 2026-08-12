#!/usr/bin/env node

import { collectFiles, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["src"];

// Regex patterns
const KEBAB_CASE_REGEX = /^[a-z0-9-]+$/;
const APPROVED_FILENAMES = ["index.ts", "main.tsx", "vite-env.d.ts", "setupTests.ts", "README.md"];

async function main() {
  // Collect all files including tests (but exclude standard directories)
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    excludeTests: false, // We check file naming for tests too
  });

  const violations = [];
  const checkedDirs = new Set();

  for (const file of files) {
    const dir = dirname(file).replace(/\\/g, "/");
    const filename = file.substring(file.lastIndexOf("/") + 1);

    // 1. Validate Directory Naming (Kebab-case)
    if (dir !== "src") {
      let currentPath = "src";
      const dirParts = dir.split("/");
      for (const part of dirParts) {
        if (part === "src" || part === "__tests__" || part === "__mocks__") continue;
        currentPath = currentPath + "/" + part;
        if (!checkedDirs.has(currentPath)) {
          checkedDirs.add(currentPath);
          if (!KEBAB_CASE_REGEX.test(part)) {
            violations.push({
              file,
              line: 1,
              rule: "Naming: Folder casing violation",
              message: `Folder name '${part}' must be in lowercase kebab-case (e.g. 'course-detail' or 'start-assessment').`,
            });
          }
        }
      }
    }

    // 2. Validate File Naming (PascalCase for component files, camelCase for hooks and utilities)
    // Strip test prefixes like .test.tsx or .spec.ts to determine original source file naming type
    const isTestFile = filename.includes(".test.") || filename.includes(".spec.");
    const cleanFilename = filename.replace(/\.(test|spec)\.([a-z0-9]+)$/, ".$2");
    
    if (!APPROVED_FILENAMES.includes(filename) && !APPROVED_FILENAMES.includes(cleanFilename)) {
      const extIndex = cleanFilename.lastIndexOf(".");
      const nameWithoutExt = extIndex !== -1 ? cleanFilename.substring(0, extIndex) : cleanFilename;
      const ext = extIndex !== -1 ? cleanFilename.substring(extIndex + 1) : "";

      const PASCAL_CASE_REGEX = /^[A-Z][a-zA-Z0-9]*$/;
      const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z0-9]*$/;
      const HOOK_CASE_REGEX = /^use[A-Z][a-zA-Z0-9]*$/;

      if (ext === "tsx") {
        // React component files (.tsx) must be PascalCase
        if (!PASCAL_CASE_REGEX.test(nameWithoutExt)) {
          violations.push({
            file,
            line: 1,
            rule: "Naming: React component file naming",
            message: `React component file '${filename}' must be in PascalCase (e.g. 'DocxContentViewer.tsx').`,
          });
        }
      } else if (ext === "ts") {
        if (nameWithoutExt.startsWith("use")) {
          // Hooks must be camelCase starting with 'use'
          if (!HOOK_CASE_REGEX.test(nameWithoutExt)) {
            violations.push({
              file,
              line: 1,
              rule: "Naming: Hook naming",
              message: `Hook file '${filename}' must be in camelCase starting with 'use' (e.g. 'useCourseProgress.ts').`,
            });
          }
        } else {
          // Utilities, schemas, stores, and API modules must be camelCase
          if (!CAMEL_CASE_REGEX.test(nameWithoutExt)) {
            violations.push({
              file,
              line: 1,
              rule: "Naming: TypeScript module naming",
              message: `TypeScript module file '${filename}' (utility, schema, store, api) must be in camelCase (e.g. 'formatDuration.ts').`,
            });
          }
        }
      }
    }
  }

  reportFindings(violations, {
    headline: "Validating directory and file naming conventions...",
    tip: "Rename folders to kebab-case (lowercase with dashes) and source files to camelCase or PascalCase.",
  });
}

main().catch((error) => {
  console.error("Error running naming conventions validation:", error);
  process.exit(1);
});
