#!/usr/bin/env node

/**
 * Cross-platform Husky setup script
 * Works on Windows, macOS, and Linux
 */

import { execSync } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const hookContent = `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Validate file types (TypeScript only)
echo "📋 Validating file types..."
npm run lint:files
if [ $? -ne 0 ]; then
  echo "❌ File type validation failed!"
  exit 1
fi

# Check for console statements
echo "✓ File types valid. Checking for console usage..."
npm run lint:console
if [ $? -ne 0 ]; then
  echo "⚠️  Console statements found (review before commit)"
fi

# Run Biome linter and formatter
echo "✓ Running Biome linter and formatter..."
npx biome lint --apply .
npx biome format --write .
if [ $? -ne 0 ]; then
  echo "⚠️  Biome formatting applied (review changes)"
fi

# Run ESLint
echo "✓ Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ ESLint check failed!"
  exit 1
fi

# Type check
echo "✓ ESLint passed. Running TypeScript type check..."
npm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ Type check failed!"
  exit 1
fi

echo "✅ All pre-commit checks passed!"
`;

async function setupHusky() {
  try {
    console.log('🔧 Setting up Husky pre-commit hooks...\n');

    // Initialize Husky
    console.log('📦 Installing Husky...');
    try {
      execSync('npx husky install', { stdio: 'inherit' });
    } catch (e) {
      // Husky might already be installed
      console.log('ℹ️  Husky already installed');
    }

    // Create .husky directory
    const huskyDir = '.husky';
    if (!existsSync(huskyDir)) {
      await mkdir(huskyDir, { recursive: true });
      console.log('📁 Created .husky directory');
    }

    // Create pre-commit hook file
    const hookPath = path.join(huskyDir, 'pre-commit');
    await writeFile(hookPath, hookContent, { encoding: 'utf-8' });
    console.log('✅ Created .husky/pre-commit hook');

    // Make hook executable on Unix-like systems
    if (process.platform !== 'win32') {
      try {
        execSync(`chmod +x ${hookPath}`, { stdio: 'inherit' });
        console.log('✅ Made hook executable');
      } catch (e) {
        console.warn('⚠️  Could not make hook executable (may not be needed)');
      }
    }

    console.log('\n✨ Husky setup complete!\n');
    console.log('🎯 Pre-commit hooks will now run:');
    console.log('  1. 📋 File type validation (TypeScript only)');
    console.log('  2. 🔍 Console usage detection');
    console.log('  3. 🎨 Biome linting and formatting');
    console.log('  4. 🔍 ESLint checks');
    console.log('  5. ✅ TypeScript type checking\n');
    console.log('🚀 Next time you run: git commit');
    console.log('   These checks will run automatically!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Husky:', error.message);
    process.exit(1);
  }
}

setupHusky();
