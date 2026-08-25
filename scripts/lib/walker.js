import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

/**
 * Recursively collects file paths from the given directories.
 * Converts path separators to forward slashes for cross-platform consistency.
 */
export async function collectFiles(rootDirs, options = {}) {
  const { excludedDirs = [], extensions = [], excludeTests = true } = options;
  const files = [];

  async function traverse(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      const relativePath = relative(process.cwd(), fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        const isExcluded = entry.name.startsWith(".") || excludedDirs.includes(entry.name);
        if (!isExcluded) {
          await traverse(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = entry.name.substring(entry.name.lastIndexOf("."));
        const isTestFile = entry.name.includes(".test.") || entry.name.includes(".spec.");

        const matchesExt = extensions.length === 0 || extensions.includes(ext);
        const matchesTestFilter = !excludeTests || !isTestFile;

        if (matchesExt && matchesTestFilter) {
          files.push(relativePath);
        }
      }
    }
  }

  for (const dir of rootDirs) {
    try {
      await traverse(dir);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(`Error reading directory ${dir}:`, error.message);
      }
    }
  }

  return files;
}

/**
 * Helper to scan lines in TS/TSX files and execute matcher.
 */
export async function scanLines(files, matcher) {
  const findings = [];
  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const lines = content.split(/\r?\n/);
      for (let idx = 0; idx < lines.length; idx++) {
        const result = matcher(lines[idx], idx + 1, file, content);
        if (result) {
          findings.push({
            file,
            line: idx + 1,
            code: lines[idx].trim(),
            ...result,
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning file ${file}:`, error.message);
    }
  }
  return findings;
}

/**
 * Standardized reporter that prints results in a clean format and exits the process.
 */
export function reportFindings(findings, options = {}) {
  const { headline = "Running validation check...", tip = "" } = options;

  console.log(headline + "\n");

  if (findings.length === 0) {
    console.log("✅ Check Complete: No violations found.\n");
    process.exit(0);
  }

  console.error(`❌ Found ${findings.length} violation(s):\n`);

  const grouped = {};
  for (const f of findings) {
    if (!grouped[f.file]) {
      grouped[f.file] = [];
    }
    grouped[f.file].push(f);
  }

  for (const [file, items] of Object.entries(grouped)) {
    console.error(`File: ${file}`);
    for (const item of items) {
      console.error(`   [Line ${item.line}]${item.rule ? ` [${item.rule}]` : ""}`);
      console.error(`   Message: ${item.message}`);
      if (item.code) {
        console.error(`   Code:    ${item.code}`);
      }
      console.error("");
    }
  }

  if (tip) {
    console.log(`Tip: ${tip}\n`);
  }

  process.exit(1);
}
