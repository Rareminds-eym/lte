import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LteEnv } from "./types";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function createServiceSupabase(
  env: Partial<Pick<LteEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">>,
  correlation?: { requestId: string; traceparent: string },
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
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        if (correlation) {
          headers.set("X-Request-Id", correlation.requestId);
          headers.set("traceparent", correlation.traceparent);
        }
        const signals = [AbortSignal.timeout(30_000)];
        const incoming = init?.signal ?? (input instanceof Request ? input.signal : undefined);
        if (incoming) signals.push(incoming);
        return fetch(input, { ...init, headers, signal: AbortSignal.any(signals) });
      },
    },
  });
}
