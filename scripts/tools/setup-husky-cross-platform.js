#!/usr/bin/env node

/**
 * Cross-platform Husky setup script.
 * Works on Windows, macOS, and Linux.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const hookContent = `echo "Running pre-commit checks..."

# Validate file types
echo "Validating file types..."
npm run lint:files
if [ $? -ne 0 ]; then
  echo "File type validation failed!"
  exit 1
fi

# Validate file lengths
echo "Validating file lengths..."
npm run lint:lengths
if [ $? -ne 0 ]; then
  echo "File length validation failed!"
  exit 1
fi

# Check for console statements
echo "File types valid. Checking for console usage..."
npm run lint:console
if [ $? -ne 0 ]; then
  echo "Console statements found (review before commit)"
fi

# Run Biome linter and formatter
echo "Running Biome linter and formatter checks..."
npm run lint:biome
if [ $? -ne 0 ]; then
  echo "Biome check failed. Run npm run format:biome to apply safe fixes."
  exit 1
fi

# Run ESLint
echo "Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
  echo "ESLint check failed!"
  exit 1
fi

# Type check
echo "ESLint passed. Running TypeScript type check..."
npm run typecheck
if [ $? -ne 0 ]; then
  echo "Type check failed!"
  exit 1
fi

echo "All pre-commit checks passed!"
`;

const prePushContent = `echo "Running pre-push checks..."

# Run Build Check
echo "Running build check..."
npm run build
if [ $? -ne 0 ]; then
  echo "Build failed! Push aborted."
  exit 1
fi

# Run Tests
echo "Running tests..."
npm run test
if [ $? -ne 0 ]; then
  echo "Tests failed! Push aborted."
  exit 1
fi

echo "All pre-push checks passed!"
`;

async function setupHusky() {
	try {
		console.log("Setting up Husky hooks...\n");

		console.log("Installing Husky...");
		try {
			execSync("npx husky", { stdio: "inherit" });
		} catch (error) {
			if (!existsSync(path.join(".husky", "_"))) {
				throw error;
			}
			console.log("Husky setup command failed; reusing existing .husky/_ config");
		}

		const huskyDir = ".husky";
		if (!existsSync(huskyDir)) {
			await mkdir(huskyDir, { recursive: true });
			console.log("Created .husky directory");
		}

		// pre-commit
		const hookPath = path.join(huskyDir, "pre-commit");
		if (!existsSync(hookPath)) {
			await writeFile(hookPath, hookContent, { encoding: "utf-8" });
			console.log("Created .husky/pre-commit hook");
		} else {
			console.log("Existing .husky/pre-commit hook found; leaving it unchanged");
		}

		// pre-push
		const prePushPath = path.join(huskyDir, "pre-push");
		if (!existsSync(prePushPath)) {
			await writeFile(prePushPath, prePushContent, { encoding: "utf-8" });
			console.log("Created .husky/pre-push hook");
		} else {
			console.log("Existing .husky/pre-push hook found; leaving it unchanged");
		}

		if (process.platform !== "win32") {
			try {
				execSync(`chmod +x ${hookPath} ${prePushPath}`, { stdio: "inherit" });
				console.log("Made hooks executable");
			} catch (error) {
				console.log(`Could not make hooks executable: ${error.message}`);
			}
		}

		console.log("\nHusky setup complete!\n");
		console.log("Pre-commit hooks will now run:");
		console.log("  1. File type validation");
		console.log("  2. File length validation (max 1000 lines)");
		console.log("  3. Console usage detection");
		console.log("  4. Biome linter and formatting checks");
		console.log("  5. ESLint checks");
		console.log("  6. TypeScript type checking\n");
		console.log("Pre-push hooks will now run:");
		console.log("  1. Running build check (npm run build)");
		console.log("  2. Running tests (npm run test)\n");
		console.log("Next time you run: git commit / git push");
		console.log("   These checks will run automatically!\n");

		process.exit(0);
	} catch (error) {
		console.error("Error setting up Husky:", error.message);
		process.exit(1);
	}
}

setupHusky();
