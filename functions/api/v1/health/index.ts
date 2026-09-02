import { jsonResponse } from "@functions/lib/http";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/shared/types";

export async function onRequestGet({ env }: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  const checks = {
    db: false,
    r2: Boolean(env.STORAGE_BUCKET),
    sso: Boolean(env.SSO_SERVICE),
  };

  try {
    const supabase = createServiceSupabase(env);
    // Shallow DB check (roles limit 1); binding existence is liveness not readiness — acceptable for anon
    const { error } = await supabase.from("roles").select("id").limit(1);
    checks.db = !error;
  } catch {
    checks.db = false;
  }

  const healthy = Object.values(checks).every(Boolean);
  const body = {
    status: healthy ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
    requestId,
  };

  return jsonResponse(body, {
    status: healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "X-Request-Id": requestId,
    },
  });
}
