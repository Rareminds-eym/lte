import { createAuthClient } from "@rareminds-eym/auth-client";

export const authClient = createAuthClient({
  namespace: "lte-auth",
  origin:
    typeof window !== "undefined" && window.location.origin.startsWith("https://")
      ? window.location.origin
      : undefined,
  csrf: { name: "X-RM-CSRF", value: "1" },
});
