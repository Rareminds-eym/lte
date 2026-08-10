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

  // Focus on router files
  const routerFiles = files.filter((file) => file.includes("src/app/router/") || file.includes("AppRouter"));

  const lineViolations = await scanLines(routerFiles, (line, lineNum) => {
    // 1. Check for static imports of pages (allow skeletons as they must be static for Suspense fallbacks)
    const hasStaticPageImport = /import\s+.*?\s+from\s+["']@\/pages\/[^"']+/i.test(line) && !line.includes("Skeleton");
    if (hasStaticPageImport) {
      return {
        rule: "Routing: Lazy loading enforcement",
        message: "Static import of pages is prohibited at the router level. Use React.lazy() and dynamic import() for routing pages instead.",
      };
    }

    // 2. Check for incorrect Suspense fallback
    if (line.includes("<Suspense") && line.includes("fallback=")) {
      if (!line.includes("PageLoader") && !line.includes("<PageLoader")) {
        return {
          rule: "Routing: Suspense fallback configuration",
          message: "Suspense fallback must use the shared <PageLoader /> component passing a route-specific loading message.",
        };
      }
    }

    return null;
  });

  violations.push(...lineViolations);

  reportFindings(violations, {
    headline: "Validating route-based lazy loading and Suspense wrapper configuration...",
    tip: "Use React.lazy(() => import('@/pages/...')) at the top of the file, and wrap lazy routes in <Suspense fallback={<PageLoader message='...' />}>.",
  });
}

main().catch((error) => {
  console.error("Error running route lazy validation:", error);
  process.exit(1);
});
