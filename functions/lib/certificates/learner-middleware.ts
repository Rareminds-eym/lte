import { jsonError } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";

/**
 * Route-scoped auth middleware for certificate endpoints. Runs requireAuth
 * once per request and exposes the authenticated user on context.data.user,
 * so handlers never repeat token verification. Scoped to /certificates because
 * /auth/sso/exchange is intentionally public.
 */
export async function learnerCertificateMiddleware(
  context: PagesContext<LteEnv>,
): Promise<Response> {
  try {
    const user = await requireAuth(context.request, context.env);
    context.data = { ...context.data, user };
    return context.next();
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
      });
    }
    throw error;
  }
}
