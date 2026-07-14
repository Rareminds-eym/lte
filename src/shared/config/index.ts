// Shared configuration constants

export const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001",
  APP_NAME: "LMS",
  APP_VERSION: "0.1.0",
  TIMEOUT: 10000,
};

export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  LOGIN: "/login",
  NOT_FOUND: "/404",
};
