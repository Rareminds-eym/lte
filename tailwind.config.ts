import type { Config } from "tailwindcss";

export default {
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				primary: "#3b82f6",
				secondary: "#8b5cf6",
				danger: "#ef4444",
				success: "#10b981",
				warning: "#f59e0b",
				info: "#0ea5e9",
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
