#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["src"];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: true,
  });

  const violations = [];

  // Check state duplication: Zustand stores should not copy TanStack Query data
  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8");
      if (content.includes("create<") && content.includes("zustand")) {
        if (content.includes("@tanstack/react-query") || content.includes("useQuery")) {
          violations.push({
            file,
            line: 1,
            rule: "State: Zustand / TanStack Query separation violation",
            message: "Do not mix Zustand stores with TanStack Query. Remote state must be managed solely by TanStack Query, and client state by Zustand.",
          });
        }
      }
    } catch (err) {
      console.error(`Error checking file ${file}:`, err.message);
    }
  }

  reportFindings(violations, {
    headline: "Validating Zustand and TanStack Query state boundaries...",
    tip: "Partition your query keys by user context (e.g. userId) and keep remote data cache inside TanStack Query hooks.",
  });
}

main().catch((error) => {
  console.error("Error running state boundaries validation:", error);
  process.exit(1);
});
