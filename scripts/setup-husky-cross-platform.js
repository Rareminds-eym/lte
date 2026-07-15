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

async function setupHusky() {
	try {
		console.log("Setting up Husky pre-commit hooks...\n");

		console.log("Installing Husky...");
		try {
			execSync("npx husky install", { stdio: "inherit" });
		} catch (error) {
			if (!existsSync(path.join(".husky", "_"))) {
				throw error;
			}
			console.log(`Husky install command failed, using existing hooks: ${error.message}`);
		}

		const huskyDir = ".husky";
		if (!existsSync(huskyDir)) {
			await mkdir(huskyDir, { recursive: true });
			console.log("Created .husky directory");
		}

		const hookPath = path.join(huskyDir, "pre-commit");
		await writeFile(hookPath, hookContent, { encoding: "utf-8" });
		console.log("Created .husky/pre-commit hook");

		if (process.platform !== "win32") {
			try {
				execSync(`chmod +x ${hookPath}`, { stdio: "inherit" });
				console.log("Made hook executable");
			} catch (error) {
				console.log(`Could not make hook executable: ${error.message}`);
			}
		}

		console.log("\nHusky setup complete!\n");
		console.log("Pre-commit hooks will now run:");
		console.log("  1. File type validation");
		console.log("  2. Console usage detection");
		console.log("  3. Biome linting and formatting checks");
		console.log("  4. ESLint checks");
		console.log("  5. TypeScript type checking\n");
		console.log("Next time you run: git commit");
		console.log("   These checks will run automatically!\n");

		process.exit(0);
	} catch (error) {
		console.error("Error setting up Husky:", error.message);
		process.exit(1);
	}
}

setupHusky();
