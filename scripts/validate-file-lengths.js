#!/usr/bin/env node

/**
 * Validates that no .ts or .tsx file under src/ and functions/ contains more than 1000 lines.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const MAX_LINES = 1000;
const EXCLUDED_DIRS = ["node_modules", ".git", "dist", "build", "coverage"];
const DIRECTORIES_TO_CHECK = ["src", "functions"];
const EXTENSIONS_TO_CHECK = [".ts", ".tsx"];

async function validateDirectory(rootDir) {
	const violations = [];

	async function traverse(currentPath) {
		try {
			const entries = await readdir(currentPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(currentPath, entry.name);
				const relativePath = relative(process.cwd(), fullPath);

				if (entry.isDirectory()) {
					if (!EXCLUDED_DIRS.includes(entry.name)) {
						await traverse(fullPath);
					}
				} else if (entry.isFile()) {
					const ext = entry.name.substring(entry.name.lastIndexOf("."));

					if (EXTENSIONS_TO_CHECK.includes(ext)) {
						const content = await readFile(fullPath, "utf-8");
						const lineCount = content.split(/\r?\n/).length;

						if (lineCount > MAX_LINES) {
							violations.push({
								file: relativePath,
								lineCount,
								message: `File exceeds maximum length of ${MAX_LINES} lines (currently ${lineCount} lines). Please break down into smaller files.`,
							});
						}
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
	console.log(
		`Validating file lengths (max ${MAX_LINES} lines for .ts and .tsx files in src/ and functions/)... \n`,
	);

	let allViolations = [];

	for (const dir of DIRECTORIES_TO_CHECK) {
		try {
			const violations = await validateDirectory(dir);
			allViolations = allViolations.concat(violations);
			console.log(`Checked ${dir}/`);
		} catch (error) {
			if (error.code !== "ENOENT") {
				console.error(`Error checking ${dir}/: ${error.message}`);
			}
		}
	}

	console.log("");

	if (allViolations.length === 0) {
		console.log(`All .ts and .tsx files in src/ and functions/ are under the ${MAX_LINES} lines limit.`);
		process.exit(0);
	}

	console.log(`Found ${allViolations.length} file length violation(s):\n`);
	allViolations.forEach((violation) => {
		console.log(`  ${violation.file}`);
		console.log(`     ${violation.message}\n`);
	});

	process.exit(1);
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
