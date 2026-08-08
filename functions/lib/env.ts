import { z } from "zod";
import type { LteEnv } from "./types";

const backendEnvSchema = z.object({
  SSO_SERVICE: z.any().refine((val) => val !== undefined && val !== null, {
    message: "SSO_SERVICE service binding is required",
  }),
  STORAGE_BUCKET: z
    .any()
    .refine((val) => val !== undefined && val !== null, {
      message: "STORAGE_BUCKET R2 binding is required",
    })
    .refine(
      (val) =>
        typeof val === "object" &&
        typeof val.put === "function" &&
        typeof val.get === "function" &&
        typeof val.head === "function" &&
        typeof val.delete === "function",
      {
        message: "STORAGE_BUCKET must be a valid R2 bucket binding",
      },
    ),
  R2_PUBLIC_DOMAIN: z.string().url("R2_PUBLIC_DOMAIN must be a valid URL").optional(),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY must not be empty"),
  COOKIE_DOMAIN: z.string().optional(),
  SKILLPASSPORT_INTERNAL_URL: z.string().url("SKILLPASSPORT_INTERNAL_URL must be a valid URL"),
  SKILLPASSPORT_INTERNAL_SECRET: z
    .string()
    .min(32, "SKILLPASSPORT_INTERNAL_SECRET must be at least 32 characters long"),
  OPENROUTER_API_KEY: z.string().optional(),
});

export function validateBackendEnv(env: unknown): LteEnv {
  const result = backendEnvSchema.safeParse(env);
  if (!result.success) {
    const errorMsg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Backend environment validation failed: ${errorMsg}`);
  }
  return result.data as LteEnv;
}
