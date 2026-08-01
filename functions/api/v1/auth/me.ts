import { AuthError, requireAuth, toAuthApiUser } from "@functions/lib/auth";
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
      if (error) {
        throw error;
      }
      if (!existingUser) {
        authLogger.warn("User data not found in LTE database during /me check", {
          userId: user.sub,
        });
        throw new AuthError(
          "LTE user record not found. Please sign in via SkillPassport.",
          "UNAUTHORIZED",
        );
      }
    }

    return jsonResponse({ user: toAuthApiUser(user) });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403);
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500);
  }
}
