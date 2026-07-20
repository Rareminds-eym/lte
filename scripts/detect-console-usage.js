#!/usr/bin/env node

/**
 * Detects console usage in src and functions directories.
 * Console statements should only be used for debugging, not in production code.
 * Excludes dedicated logger implementation files and tests.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const DIRECTORIES_TO_CHECK = ["src", "functions"];
const EXCLUDED_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	"coverage",
	"__tests__",
];
const EXCLUDED_FILES = [
	"src/shared/config/logging.ts",
	"functions/lib/logger.ts",
];
const CONSOLE_PATTERNS = [
	{ pattern: /console\.log\s*\(/, method: "console.log" },
	{ pattern: /console\.debug\s*\(/, method: "console.debug" },
	{ pattern: /console\.info\s*\(/, method: "console.info" },
	{ pattern: /console\.warn\s*\(/, method: "console.warn" },
	{ pattern: /console\.error\s*\(/, method: "console.error" },
	{ pattern: /console\.trace\s*\(/, method: "console.trace" },
];

async function checkDirectory(rootDir) {
	const findings = [];

	async function traverse(currentPath) {
		try {
			const entries = await readdir(currentPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(currentPath, entry.name);
				const relativePath = relative(process.cwd(), fullPath).replace(/\\/g, "/");

				if (entry.isDirectory()) {
					const isExcluded =
						entry.name.startsWith(".") || EXCLUDED_DIRS.includes(entry.name);

					if (!isExcluded) {
						await traverse(fullPath);
					}
				} else if (entry.isFile()) {
					const ext = entry.name.substring(entry.name.lastIndexOf("."));

					if (
						[".ts", ".tsx"].includes(ext) &&
						!entry.name.includes(".test.") &&
						!entry.name.includes(".spec.") &&
						!EXCLUDED_FILES.includes(relativePath)
					) {
						try {
							const content = await readFile(fullPath, "utf-8");
							const lines = content.split("\n");

							for (const { pattern, method } of CONSOLE_PATTERNS) {
								for (let lineNum = 0; lineNum < lines.length; lineNum += 1) {
									const line = lines[lineNum];
									if (pattern.test(line)) {
										findings.push({
											file: relativePath,
											line: lineNum + 1,
											method,
											code: line.trim(),
											message: `Found ${method} statement in production code`,
										});
									}
								}
							}
						} catch (error) {
							console.error(`Error reading file ${fullPath}:`, error.message);
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
	console.log("Scanning for console statements in src/ and functions/...\n");

	let allFindings = [];

	for (const dir of DIRECTORIES_TO_CHECK) {
		try {
			const findings = await checkDirectory(dir);
			allFindings = allFindings.concat(findings);
			console.log(`Scanned ${dir}/`);
		} catch (error) {
			if (error.code !== "ENOENT") {
				console.error(`Error checking ${dir}/: ${error.message}`);
			}
		}
	}

	console.log("");

	if (allFindings.length === 0) {
		console.log(
			"No unapproved console statements found in production code (src/ and functions/)\n",
		);
		process.exit(0);
	}

	console.log(
		`Found ${allFindings.length} console statement(s) in production code:\n`,
	);

	const grouped = {};
	allFindings.forEach((finding) => {
		if (!grouped[finding.file]) {
			grouped[finding.file] = [];
		}
		grouped[finding.file].push(finding);
	});

	Object.entries(grouped).forEach(([file, findings]) => {
		console.log(file);
		findings.forEach((finding) => {
			console.log(`   Line ${finding.line}: ${finding.method}`);
			console.log(`   -> ${finding.code}`);
		});
		console.log("");
	});

	console.log(
		"Tip: Use proper logging (logger.debug(), logger.error()) instead of console",
	);
	console.log("   Or remove console statements for production code\n");

	process.exit(0);
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
