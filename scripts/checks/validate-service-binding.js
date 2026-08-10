#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["functions"];

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts"],
    excludeTests: true,
  });

  const violations = await scanLines(files, (line, lineNum) => {
    // Exclude comments
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) {
      return null;
    }

    // Flag REST-style fetch calls to sso-worker or sso-api inside backend functions
    const usesFetchToSso = 
      (/fetch\s*\(/i.test(line) || /new\s+Request\s*\(/i.test(line)) && 
      (line.includes("sso-worker") || line.includes("sso-api") || line.includes("/auth/"));

    if (usesFetchToSso) {
      return {
        rule: "Integration: Non-RPC backend call detected",
        message: "Cross-worker communication to the SSO worker must use native Service Binding RPC calls (env.SSO_SERVICE) instead of REST/HTTP fetch calls.",
      };
    }
    return null;
  });

  reportFindings(violations, {
    headline: "Validating cross-worker RPC service binding communication in backend...",
    tip: "Call env.SSO_SERVICE RPC methods directly (e.g. env.SSO_SERVICE.getMe(token)) instead of raw HTTP fetch.",
  });
}

main().catch((error) => {
  console.error("Error running service binding validation:", error);
  process.exit(1);
});
