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
