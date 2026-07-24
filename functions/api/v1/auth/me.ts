import { requireAuth, toAuthApiUser } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { authLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  try {
    const user = await requireAuth(context.request, context.env);

    // Verify user exists in LTE local database (public.users)
    if (context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createServiceSupabase(context.env);
      const { data: existingUser, error } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.sub)
        .maybeSingle();
      if (error || !existingUser) {
        authLogger.warn("User data not found in LTE database during /me check", {
          userId: user.sub,
        });
        throw new Error("LTE user record not found. Please sign in via SkillPassport.");
      }
    }

    return jsonResponse({ user: toAuthApiUser(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthenticated";
    return jsonError(message, 401);
  }
}
