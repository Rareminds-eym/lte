#!/usr/bin/env node

import { collectFiles, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["functions/api"];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts"],
    excludeTests: true,
  });

  const violations = [];

  for (const file of files) {
    // Skip centralized auth handlers
    if (file.startsWith("functions/api/v1/auth/")) continue;

    try {
      const content = readFileSync(file, "utf-8");

      // Check if file exports any onRequest* API handlers
      const hasApiHandler = /export\s+async\s+function\s+onRequest(Get|Post|Put|Patch|Delete)\b/.test(content);
      if (hasApiHandler) {
        // Only require Zod validation if the handler actually reads input parameters from the request
        const readsRequestInputs = 
          content.includes("searchParams") || 
          content.includes(".json(") || 
          content.includes(".formData(") || 
          content.includes("context.params") ||
          /\.params\b/.test(content);

        if (readsRequestInputs) {
          // Check if Zod schema parsing is invoked (e.g. schema.parse() or schema.safeParse())
          const hasZodValidation = 
            content.includes(".safeParse(") || 
            content.includes(".parse(") || 
            content.includes("validate("); // Custom wrapper

          if (!hasZodValidation) {
            violations.push({
              file,
              line: 1,
              rule: "Validation: Request validation missing",
              message: "API handlers must validate request payloads (body, query, or route params) immediately at the boundary using a Zod schema.",
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning ${file}:`, error.message);
    }
  }

  reportFindings(violations, {
    headline: "Validating runtime Zod schema parsing at API boundaries...",
    tip: "Import/define a Zod schema and call schema.safeParse(context.params / body) at the start of your API handler.",
  });
}

main().catch((error) => {
  console.error("Error running Zod boundaries validation:", error);
  process.exit(1);
});
