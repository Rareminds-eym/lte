import react from "@vitejs/plugin-react";
import path from "node:path";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
	css: {
		postcss: "./postcss.config.js",
	},
	plugins: [
		svgr({
			include: "**/*.svg",
		}),
		react(),
	],
	resolve: {
		tsconfigPaths: true,
		alias: [
			// @rareminds-eym/* packages resolve via node_modules (published to
			// GitHub Packages); sibling-path aliases were removed with the
			// file:-dependency migration so builds are portable.
			...(process.env.VITEST
				? [
					// Mock bare specifiers only, so functions/** subpath imports
					// (e.g. pdfjs-dist/legacy/build/pdf.mjs) resolve to the real libs.
					{
						find: /^@file-viewer\/pptx$/,
						replacement: path.resolve(__dirname, "./src/__mocks__/viewerLibs.ts"),
					},
					{
						find: /^docx-preview$/,
						replacement: path.resolve(__dirname, "./src/__mocks__/viewerLibs.ts"),
					},
					{
						find: /^pdfjs-dist$/,
						replacement: path.resolve(__dirname, "./src/__mocks__/viewerLibs.ts"),
					},
					{
						find: /^xlsx$/,
						replacement: path.resolve(__dirname, "./src/__mocks__/viewerLibs.ts"),
					},
				]
				: [
					{
						find: /^xlsx$/,
						replacement: path.resolve(
							__dirname,
							"./vendor/sheetjs/xlsx-0.20.3/xlsx.mjs",
						),
					},
				]),
		],
	},
	optimizeDeps: {
		exclude: ["@file-viewer/pptx"],
	},
	server: {
		host: '0.0.0.0',
		port: 8080,
		strictPort: true,
		open: true,
		allowedHosts: ["localhost", "127.0.0.1"],
		proxy: {
			"/api": {
				target: "http://127.0.0.1:8789",
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: "dist",
		sourcemap: "hidden",
		chunkSizeWarningLimit: 2500,
		rollupOptions: {
			output: {
				manualChunks(id) {
					const normalized = id.replaceAll("\\", "/");
					if (
						normalized.includes("node_modules/react/") ||
						normalized.includes("node_modules/react-dom/") ||
						normalized.includes("node_modules/react-router/") ||
						normalized.includes("node_modules/react-router-dom/")
					) {
						return "framework";
					}
					if (normalized.includes("node_modules/pdfjs-dist/")) {
						return "pdf-vendor";
					}
					if (
						normalized.includes("vendor/sheetjs/xlsx-0.20.3/")
					) {
						return "spreadsheet-vendor";
					}
					if (
						normalized.includes("node_modules/docx-preview/")
					) {
						return "docx-vendor";
					}
					if (
						normalized.includes("node_modules/@file-viewer/") ||
						normalized.includes("node_modules/billboard.js/") ||
						normalized.includes("node_modules/d3-")
					) {
						return "pptx-vendor";
					}
					if (normalized.includes("node_modules/@tanstack/react-query/")) {
						return "query-vendor";
					}
				},
			},
		},
	},
	test: {
		globals: true,
		// Tier 1: Skip Tailwind v4 + PostCSS transform during tests.
		css: false,
		// Tier 1: Run test files in parallel across worker threads.
		pool: "threads",
		maxWorkers: "50%",
		// Tier 3: Pre-bundle heavy dependencies with esbuild so each worker doesn't
		// re-resolve and re-transform them from the module graph individually.
		deps: {
			optimizer: {
				client: {
					enabled: true,
					include: [
						"react",
						"react-dom",
						"react-dom/client",
						"@tanstack/react-query",
						"zustand",
						"react-hot-toast",
						"react-error-boundary",
					],
				},
			},
		},
		projects: [
			{
				extends: true,
				test: {
					name: "frontend",
					globals: true,
					environment: "happy-dom",
					isolate: true,
					include: ["src/**/*.test.{ts,tsx}"],
					setupFiles: "./src/setupTests.ts",
					alias: {
						"@": path.resolve(__dirname, "./src"),
						"@functions": path.resolve(__dirname, "./functions"),
						"@file-viewer/pptx": path.resolve(__dirname, "./src/__mocks__/viewerLibs.ts"),
						"docx-preview": path.resolve(__dirname, "./src/__mocks__/viewerLibs.ts"),
						"pdfjs-dist": path.resolve(__dirname, "./src/__mocks__/viewerLibs.ts"),
						"xlsx": path.resolve(__dirname, "./src/__mocks__/viewerLibs.ts"),
					},
				},
			},
			{
				extends: true,
				test: {
					name: "backend",
					globals: true,
					environment: "node",
					isolate: true,
					include: ["functions/**/*.test.ts"],
					alias: {
						"@": path.resolve(__dirname, "./src"),
						"@functions": path.resolve(__dirname, "./functions"),
					},
				},
			},
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov", "html", "json-summary"],
			exclude: [
				"node_modules/",
				"src/setupTests.ts",
				"**/*.d.ts",
				"src/shared/config/env.ts",
				"src/entities/**/model/types.ts",
				"src/index.tsx",
				"**/*.css",
				"**/*.svg",
				"**/*.{spec,test}.{ts,tsx}",
				"**/index.ts",
				"**/index.tsx",
			],
			thresholds: {
				branches: 75,
				functions: 75,
				lines: 80,
				statements: 80,
			},
		},
	},
});

