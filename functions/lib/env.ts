import { z } from "zod";
import type {
  AssetsBinding,
  LteEnv,
  QueueSender,
  R2BucketBinding,
  RateLimitKvBinding,
} from "./types";

const bindingSchema = <T>(name: string, methods: readonly string[]) =>
  z.custom<T>(
    (value) =>
      Boolean(
        value &&
          typeof value === "object" &&
          methods.every(
            (method) =>
              method in value && typeof value[method as keyof typeof value] === "function",
          ),
      ),
    `${name} must be a valid binding`,
  );

const backendEnvSchema = z
  .object({
    BROWSER_RENDERING_API_TOKEN: z.string().trim().min(1),
    CF_ACCOUNT_ID: z.string().regex(/^[a-f0-9]{32}$/i),
    CERTIFICATE_VERIFY_BASE_URL: z
      .url()
      .refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
    RATE_LIMIT_KV: bindingSchema<RateLimitKvBinding>("RATE_LIMIT_KV", ["list", "put"]),
    ASSETS: bindingSchema<AssetsBinding>("ASSETS", ["fetch"]),
    LTE_SYNC_QUEUE: bindingSchema<QueueSender>("LTE_SYNC_QUEUE", ["send"]).optional(),
    SSO_SERVICE: z.any().refine((val) => val !== undefined && val !== null, {
      message: "SSO_SERVICE service binding is required",
    }),
    STORAGE_BUCKET: bindingSchema<R2BucketBinding>("STORAGE_BUCKET", [
      "put",
      "get",
      "head",
      "delete",
      "list",
    ]),
    R2_PUBLIC_DOMAIN: z.string().url("R2_PUBLIC_DOMAIN must be a valid URL").optional(),
    SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY must not be empty"),
    COOKIE_DOMAIN: z.string().optional(),
    SKILLPASSPORT_INTERNAL_URL: z.string().url("SKILLPASSPORT_INTERNAL_URL must be a valid URL"),
    SKILLPASSPORT_INTERNAL_SECRET: z
      .string()
      .min(32, "SKILLPASSPORT_INTERNAL_SECRET must be at least 32 characters long"),
    OPENROUTER_API_KEY: z.string().trim().min(1, "OPENROUTER_API_KEY must not be empty"),
  })
  .passthrough();

export function validateBackendEnv(env: unknown): LteEnv {
  const result = backendEnvSchema.safeParse(env);
  if (!result.success) {
    const errorMsg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Backend environment validation failed: ${errorMsg}`);
  }
  return result.data as LteEnv;
}
