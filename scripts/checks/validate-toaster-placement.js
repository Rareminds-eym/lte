#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["src"];
const APPROVED_TOASTER_FILE = "src/app/providers/AppProviders.tsx";

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: true,
  });

  const filesToCheck = files.filter((file) => file !== APPROVED_TOASTER_FILE);

  const violations = await scanLines(filesToCheck, (line, lineNum) => {
    const trimmedLine = line.trim();
    const isComment = trimmedLine.startsWith("//") || trimmedLine.startsWith("*") || trimmedLine.startsWith("/*");

    if (isComment) return null;

    // 1. Check for `<Toaster` component mounting
    const hasToasterMount = /<Toaster\b/i.test(line);
    if (hasToasterMount) {
      return {
        rule: "UI: Duplicate Toaster declaration",
        message: `Local <Toaster /> instance detected. Declare Toast providers globally and only inside '${APPROVED_TOASTER_FILE}'.`,
      };
    }

    // 2. Check for bare toast() call (untyped)
    const hasBareToast = /\btoast\s*\(/i.test(line);
    if (hasBareToast) {
      return {
        rule: "UI: Bare untyped toast call",
        message: "Untyped bare toast() call detected. Use typed notifications like 'toast.success()' or 'toast.error()' to ensure standard visual cues.",
      };
    }

    return null;
  });

  reportFindings(violations, {
    headline: "Scanning for unauthorized local <Toaster /> component declarations...",
    tip: "Remove local <Toaster /> components. Trigger toast notifications dynamically by importing 'toast' from '@/shared/ui'.",
  });
}

main().catch((error) => {
  console.error("Error running toaster placement validation:", error);
  process.exit(1);
});
