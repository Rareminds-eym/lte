import { createAuthClient } from "@rareminds-eym/auth-client";
import { AUTH_CLIENT_CONFIG } from "@/shared/config";

export const authClient = createAuthClient({
  namespace: AUTH_CLIENT_CONFIG.NAMESPACE,
  origin:
    typeof window !== "undefined" && window.location.origin.startsWith("https://")
      ? window.location.origin
      : undefined,
  csrf: AUTH_CLIENT_CONFIG.CSRF,
});
