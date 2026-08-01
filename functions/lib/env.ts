import { z } from "zod";
import type { LteEnv } from "./types";

const backendEnvSchema = z.object({
  SSO_SERVICE: z.any().refine((val) => val !== undefined && val !== null, {
    message: "SSO_SERVICE service binding is required",
  }),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY must not be empty"),
  COOKIE_DOMAIN: z.string().optional(),
});

export function validateBackendEnv(env: unknown): LteEnv {
  const result = backendEnvSchema.safeParse(env);
  if (!result.success) {
    const errorMsg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Backend environment validation failed: ${errorMsg}`);
  }
  return result.data as LteEnv;
}
