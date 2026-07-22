import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
	{ ignores: ["dist", "build", "node_modules", "coverage", ".wrangler", "*.config.js", "**/*.js", "**/*.jsx"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		plugins: {
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
			boundaries: boundaries,
		},
		settings: {
			"boundaries/elements": [
				{ type: "app", pattern: "src/app/**/*" },
				{ type: "pages", pattern: "src/pages/**/*" },
				{ type: "widgets", pattern: "src/widgets/**/*" },
				{ type: "features", pattern: "src/features/**/*" },
				{ type: "entities", pattern: "src/entities/**/*" },
				{ type: "shared", pattern: "src/shared/**/*" },
			],
			"boundaries/ignore": ["**/*.test.*", "**/*.spec.*"],
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			"react-refresh/only-export-components": [
				"warn",
				{ allowConstantExport: true },
			],
			"no-console": "warn",
			"no-debugger": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"boundaries/dependencies": [
				"error",
				{
					default: "disallow",
					rules: [
						{
							from: { type: "app" },
							allow: {
								to: {
									type: ["pages", "widgets", "features", "entities", "shared"],
								},
							},
						},
						{
							from: { type: "pages" },
							allow: {
								to: { type: ["widgets", "features", "entities", "shared"] },
							},
						},
						{
							from: { type: "widgets" },
							allow: { to: { type: ["features", "entities", "shared"] } },
						},
						{
							from: { type: "features" },
							allow: { to: { type: ["entities", "shared"] } },
						},
						{
							from: { type: "entities" },
							allow: { to: { type: "shared" } },
						},
					],
				},
			],
		},
	},
	{
		files: [
			"src/shared/config/logging.ts",
			"functions/lib/logger.ts",
			"src/__tests__/**/*",
			"**/*.test.*",
			"**/*.spec.*",
		],
		rules: {
			"no-console": "off",
		},
	},
];
