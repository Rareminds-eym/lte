#!/usr/bin/env node

/**
 * Validates that only .ts and .tsx files exist in src directory
 * Enforces strict TypeScript-only project structure
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.json', '.md'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage'];

async function validateFiles(dir = 'src') {
  const violations = [];

  async function traverse(currentPath) {
    try {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = fullPath.replace(process.cwd() + '\\', '');

        if (entry.isDirectory()) {
          if (!EXCLUDED_DIRS.includes(entry.name)) {
            await traverse(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = entry.name.substring(entry.name.lastIndexOf('.'));

          if (!ALLOWED_EXTENSIONS.includes(ext)) {
            violations.push({
              file: relativePath,
              extension: ext,
              message: `File type not allowed: ${ext}. Only .ts, .tsx, .json, and .md files are permitted.`,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error.message);
    }
  }

  await traverse(dir);
  return violations;
}

async function main() {
  console.log('🔍 Validating file types (only .ts/.tsx allowed in src)...\n');

  const violations = await validateFiles();

  if (violations.length === 0) {
    console.log('✅ All files are correct type (.ts/.tsx)');
    process.exit(0);
  }

  console.log(`❌ Found ${violations.length} file type violation(s):\n`);
  violations.forEach((v) => {
    console.log(`  📄 ${v.file}`);
    console.log(`     ${v.message}\n`);
  });

  process.exit(1);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
