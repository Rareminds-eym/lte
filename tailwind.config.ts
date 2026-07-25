import type { Config } from "tailwindcss";

export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				// ── Semantic design tokens (reference CSS custom properties) ──
				brand: {
					50: "var(--color-brand-50)",
					100: "var(--color-brand-100)",
					200: "var(--color-brand-200)",
					500: "var(--color-brand-500)",
					600: "var(--color-brand-600)",
					700: "var(--color-brand-700)",
				},
				success: {
					50: "var(--color-success-50)",
					100: "var(--color-success-100)",
					200: "var(--color-success-200)",
					500: "var(--color-success-500)",
					600: "var(--color-success-600)",
					700: "var(--color-success-700)",
				},
				warning: {
					50: "var(--color-warning-50)",
					100: "var(--color-warning-100)",
					200: "var(--color-warning-200)",
					500: "var(--color-warning-500)",
					600: "var(--color-warning-600)",
					700: "var(--color-warning-700)",
				},
				surface: {
					primary: "var(--color-surface-primary)",
					secondary: "var(--color-surface-secondary)",
					muted: "var(--color-surface-muted)",
				},
				content: {
					primary: "var(--color-content-primary)",
					secondary: "var(--color-content-secondary)",
					muted: "var(--color-content-muted)",
				},
				line: {
					default: "var(--color-border-default)",
					subtle: "var(--color-border-subtle)",
				},
			},
			borderRadius: {
				DEFAULT: "0.375rem",
			},
			transitionDuration: {
				DEFAULT: "200ms",
			},
		},
	},
	plugins: [],
} satisfies Config;
