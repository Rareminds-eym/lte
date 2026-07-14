#!/usr/bin/env node

/**
 * Validates that only .ts and .tsx files exist in src and functions directories
 * Enforces strict TypeScript-only project structure
 */

import { readdir } from 'fs/promises';
import { join } from 'path';

const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.json', '.md', '.wasm', '.css'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage'];
const DIRECTORIES_TO_CHECK = ['src', 'functions'];

async function validateDirectory(rootDir) {
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
              message: `File type not allowed: ${ext}. Only .ts, .tsx, .json, .md, .css, and .wasm files are permitted.`,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error.message);
    }
  }

  await traverse(rootDir);
  return violations;
}

async function main() {
  console.log('🔍 Validating file types (only .ts/.tsx allowed in src/ and functions/)...\n');

  let allViolations = [];

  for (const dir of DIRECTORIES_TO_CHECK) {
    try {
      const violations = await validateDirectory(dir);
      allViolations = allViolations.concat(violations);
      console.log(`✓ Checked ${dir}/`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`⚠️  Error checking ${dir}/: ${error.message}`);
      }
    }
  }

  console.log('');

  if (allViolations.length === 0) {
    console.log('✅ All files are correct type (.ts/.tsx) in src/ and functions/');
    process.exit(0);
  }

  console.log(`❌ Found ${allViolations.length} file type violation(s):\n`);
  allViolations.forEach((v) => {
    console.log(`  📄 ${v.file}`);
    console.log(`     ${v.message}\n`);
  });

  process.exit(1);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
