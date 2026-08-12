#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs, allowedImageFiles } = config;

const DIRECTORIES_TO_CHECK = ["src"];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".tsx"],
    excludeTests: true,
  });

  const filesToCheck = files.filter((file) => !allowedImageFiles.includes(file));

  const violations = await scanLines(filesToCheck, (line, lineNum) => {
    // Check for native <img elements but ignore commented lines
    const hasNativeImg = /<img\b/i.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*");
    if (hasNativeImg) {
      return {
        rule: "UI: Native img tag usage detected",
        message: "All images must use the shared <Image /> component from '@/shared/ui/Image' for lazy loading and CLS prevention.",
      };
    }
    return null;
  });

  reportFindings(violations, {
    headline: "Scanning for native img tags inside UI components...",
    tip: "Replace raw <img> tags with the custom <Image /> component.",
  });
}

main().catch((error) => {
  console.error("Error running image component validation:", error);
  process.exit(1);
});
