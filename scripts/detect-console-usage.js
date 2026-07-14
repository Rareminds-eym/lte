#!/usr/bin/env node

/**
 * Detects console usage in src and functions directories
 * Console statements should only be used for debugging, not in production code
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const DIRECTORIES_TO_CHECK = ['src', 'functions'];
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__', '.test.ts', '.spec.ts'];
const CONSOLE_PATTERNS = [
  { pattern: /console\.log\s*\(/g, method: 'console.log' },
  { pattern: /console\.debug\s*\(/g, method: 'console.debug' },
  { pattern: /console\.info\s*\(/g, method: 'console.info' },
  { pattern: /console\.warn\s*\(/g, method: 'console.warn' },
  { pattern: /console\.error\s*\(/g, method: 'console.error' },
  { pattern: /console\.trace\s*\(/g, method: 'console.trace' },
];

async function checkDirectory(rootDir) {
  const findings = [];

  async function traverse(currentPath) {
    try {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = fullPath.replace(process.cwd() + '\\', '');

        if (entry.isDirectory()) {
          // Skip excluded directories and test directories
          const isExcluded = EXCLUDED_DIRS.some(
            (dir) =>
              entry.name.includes(dir) ||
              entry.name.startsWith('.') ||
              entry.name === '__tests__'
          );

          if (!isExcluded) {
            await traverse(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = entry.name.substring(entry.name.lastIndexOf('.'));

          // Only check TypeScript/TSX files
          if (['.ts', '.tsx'].includes(ext)) {
            // Skip test files
            if (
              !entry.name.includes('.test.') &&
              !entry.name.includes('.spec.')
            ) {
              try {
                const content = await readFile(fullPath, 'utf-8');
                const lines = content.split('\n');

                for (const { pattern, method } of CONSOLE_PATTERNS) {
                  let match;
                  pattern.lastIndex = 0;

                  lines.forEach((line, lineNum) => {
                    if (pattern.test(line)) {
                      findings.push({
                        file: relativePath,
                        line: lineNum + 1,
                        method,
                        code: line.trim(),
                        message: `Found ${method} statement in production code`,
                      });
                    }
                  });
                }
              } catch (error) {
                console.error(`Error reading file ${fullPath}:`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error.message);
    }
  }

  await traverse(rootDir);
  return findings;
}

async function main() {
  console.log(
    '🔍 Scanning for console statements in src/ and functions/...\n'
  );

  let allFindings = [];

  for (const dir of DIRECTORIES_TO_CHECK) {
    try {
      const findings = await checkDirectory(dir);
      allFindings = allFindings.concat(findings);
      console.log(`✓ Scanned ${dir}/`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`⚠️  Error checking ${dir}/: ${error.message}`);
      }
    }
  }

  console.log('');

  if (allFindings.length === 0) {
    console.log(
      '✅ No console statements found in production code (src/ and functions/)\n'
    );
    process.exit(0);
  }

  console.log(
    `⚠️  Found ${allFindings.length} console statement(s) in production code:\n`
  );

  // Group by file
  const grouped = {};
  allFindings.forEach((finding) => {
    if (!grouped[finding.file]) {
      grouped[finding.file] = [];
    }
    grouped[finding.file].push(finding);
  });

  Object.entries(grouped).forEach(([file, findings]) => {
    console.log(`📄 ${file}`);
    findings.forEach((f) => {
      console.log(`   Line ${f.line}: ${f.method}`);
      console.log(`   └─ ${f.code}`);
    });
    console.log('');
  });

  console.log('💡 Tip: Use proper logging (logger.debug(), logger.error()) instead of console');
  console.log('   Or remove console statements for production code\n');

  // Exit with warning code (not error) since console isn't as critical as file types
  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
