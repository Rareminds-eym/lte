import path from "node:path";
import react from "@vitejs/plugin-react";
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
		...(process.env.VITEST
			? {
					alias: {
						"@file-viewer/pptx": path.resolve(__dirname, "./src/__mocks__/fileViewerPptx.ts"),
						"docx-preview": path.resolve(__dirname, "./src/__mocks__/fileViewerPptx.ts"),
						"pdfjs-dist": path.resolve(__dirname, "./src/__mocks__/fileViewerPptx.ts"),
						xlsx: path.resolve(__dirname, "./src/__mocks__/fileViewerPptx.ts"),
					},
				}
			: {}),
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
						normalized.includes("node_modules/xlsx/")
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
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov", "html"],
			exclude: [
				"node_modules/",
				"src/setupTests.ts",
				"**/*.d.ts",
				"src/shared/config/env.ts",
				"src/index.tsx",
				"**/*.css",
				"**/*.svg",
				"**/*.{spec,test}.{ts,tsx}",
				"**/index.ts",
				"**/index.tsx",
			],
			thresholds: {
				branches: 70,
				functions: 70,
				lines: 70,
				statements: 70,
			},
		},
	},
});
