import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LteEnv } from "./types";

export function createServiceSupabase(
  env: Partial<Pick<LteEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">>,
): SupabaseClient {
  if (!env.SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured. Please set SUPABASE_URL in your environment.");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Please set SUPABASE_SERVICE_ROLE_KEY in your environment.",
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
