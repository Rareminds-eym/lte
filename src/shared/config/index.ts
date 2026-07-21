// Shared configuration constants

export const CONFIG = {
  APP_NAME: "LTE",
  APP_VERSION: "0.1.0",
  TIMEOUT: 10000,
};

export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  LOGIN: "/login",
  NOT_FOUND: "/404",
};

export function getSkillpassportUrl(): string {
  const url = import.meta.env["VITE_SKILLPASSPORT_URL"]?.trim();
  if (!url) {
    throw new Error("VITE_SKILLPASSPORT_URL environment variable is not configured");
  }
  return url.replace(/\/+$/, "");
}

export * from "./logging";
