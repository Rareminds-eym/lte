#!/usr/bin/env node

import { collectFiles, scanLines, reportFindings } from "../lib/walker.js";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/codereview-rules.json", import.meta.url), "utf-8"));
const { excludedDirs } = config;

const DIRECTORIES_TO_CHECK = ["src"];
const LAYER_WEIGHTS = {
  app: 6,
  pages: 5,
  widgets: 4,
  features: 3,
  entities: 2,
  shared: 1,
};

function getLayerAndSlice(path) {
  const parts = path.split("/");
  if (parts[0] === "src" && parts.length > 1) {
    const layer = parts[1];
    const slice = parts[2] || null;
    return { layer, slice };
  }
  return { layer: null, slice: null };
}

async function main() {
  const files = await collectFiles(DIRECTORIES_TO_CHECK, {
    excludedDirs,
    extensions: [".ts", ".tsx"],
    excludeTests: true,
  });

  const violations = [];

  // Check file path structure for invalid page subfolders (e.g., pages/components, pages/hooks, pages/utils)
  for (const file of files) {
    if (file.startsWith("src/pages/")) {
      const parts = file.split("/");
      if (parts.length > 3) {
        const subfolder = parts[3];
        if (["components", "hooks", "utils"].includes(subfolder)) {
          violations.push({
            file,
            line: 1,
            rule: "FSD: Page segment subfolder violation",
            message: `Pages must use FSD slice segments. Generic folders like 'src/pages/${parts[2]}/${subfolder}/' are not allowed.`,
          });
        }
      }
    }
  }

  // Scan import statements
  const lineViolations = await scanLines(files, (line, lineNum, file) => {
    const importMatch = line.match(/(?:from|import)\s*\(?\s*["'](@\/([^"'\s]+))["']/);
    if (!importMatch) return null;

    const importPath = importMatch[2]; // e.g. "features/xp-reward/ui/XpRewardModal"
    const importParts = importPath.split("/");
    const importLayer = importParts[0]; // e.g. "features"
    const importSlice = importParts[1] || null; // e.g. "xp-reward"

    const currentInfo = getLayerAndSlice(file);
    const currentLayer = currentInfo.layer;
    const currentSlice = currentInfo.slice;

    if (!currentLayer || !LAYER_WEIGHTS[currentLayer] || !LAYER_WEIGHTS[importLayer]) {
      return null;
    }

    // 1. Check upward imports
    if (LAYER_WEIGHTS[importLayer] > LAYER_WEIGHTS[currentLayer]) {
      return {
        rule: "FSD: Upward import violation",
        message: `Upward import detected: Layer '${currentLayer}' cannot import from '${importLayer}' (${importMatch[1]}).`,
      };
    }

    // 2. Check deep imports crossing slice boundaries
    if (["pages", "widgets", "features", "entities"].includes(importLayer)) {
      const isCrossSlice = currentLayer !== importLayer || currentSlice !== importSlice;
      if (isCrossSlice && importSlice) {
        // If they import beyond slice root (e.g., importParts has length > 2) and it's not a barrel import
        // e.g. "@/features/xp-reward/ui/XpRewardModal" has length 4. Allowed: "@/features/xp-reward" or "@/features/xp-reward/index"
        const isDeepImport = importParts.length > 2 && importParts[2] !== "index";
        if (isDeepImport) {
          return {
            rule: "FSD: Public API barrel import violation",
            message: `Deep import crossing slice boundaries: must import from the slice barrel '${importLayer}/${importSlice}' instead of deep path (${importMatch[1]}).`,
          };
        }
      }
    }

    return null;
  });

  violations.push(...lineViolations);

  reportFindings(violations, {
    headline: "Analyzing FSD layer boundaries and slice imports...",
    tip: "Use the slice's public API barrel (index.ts) for importing from other slices, and respect the layer hierarchy.",
  });
}

main().catch((error) => {
  console.error("Error running FSD validation:", error);
  process.exit(1);
});
