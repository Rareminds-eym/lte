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
		alias: process.env.VITEST
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
		environment: "jsdom",
		setupFiles: "./src/setupTests.ts",
		css: true,
		watch: false,
		passWithNoTests: false,
		isolate: true,
		fileParallelism: false,
		maxWorkers: 1,
		minWorkers: 1,
		retry: 0,
		allowOnly: false,
		sequence: { shuffle: false },
		fakeTimers: { shouldAdvanceTime: false },
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
