// Auth client wiring constants. Must stay in sync with the SSO gateway
// configuration in functions/[[path]].ts (same CSRF header contract).
export const AUTH_CLIENT_CONFIG = {
  NAMESPACE: "lte-auth",
  CSRF: { name: "X-RM-CSRF", value: "1" },
} as const;
