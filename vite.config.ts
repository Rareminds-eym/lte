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
		port: 3000,
		open: true,
	},
	build: {
		outDir: "dist",
		sourcemap: true,
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
