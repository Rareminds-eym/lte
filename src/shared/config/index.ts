import { getClientEnv } from "./env";

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
  MY_COURSES: "/my-courses",
  COURSES: "/courses",
};

export const routeForModule = (levelId: string, moduleNo: number) =>
  `${ROUTES.MY_COURSES}/${encodeURIComponent(levelId)}/modules/${moduleNo}`;

export const routeForLevel = (capabilityCode: string, levelId: string) =>
  `${ROUTES.COURSES}/${encodeURIComponent(capabilityCode)}/levels/${encodeURIComponent(levelId)}`;

export function getSkillpassportUrl(): string {
  return getClientEnv().VITE_SKILLPASSPORT_URL.replace(/\/+$/, "");
}

export * from "./env";
export * from "./logging";
