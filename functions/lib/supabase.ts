import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LteEnv } from "./types";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function createServiceSupabase(
  env: Partial<Pick<LteEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">>,
): SupabaseClient {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }

  return createClient(parsed.data.SUPABASE_URL, parsed.data.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
