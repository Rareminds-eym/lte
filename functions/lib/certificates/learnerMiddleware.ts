import { jsonError } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { certificateRequestContext, correlateResponse } from "./http";
import { logCertificateFailure } from "./logging";

/**
 * Route-scoped auth middleware for certificate endpoints. Runs requireAuth
 * once per request and exposes the authenticated user on context.data.user,
 * so handlers never repeat token verification. Scoped to /certificates because
 * /auth/sso/exchange is intentionally public.
 */
export async function learnerCertificateMiddleware(
  context: PagesContext<LteEnv>,
): Promise<Response> {
  let requestId: string = crypto.randomUUID();
  let traceparent = "";
  try {
    const correlation = certificateRequestContext(context);
    requestId = correlation.requestId;
    traceparent = correlation.traceparent;
    const headers = new Headers(context.request.headers);
    headers.set("X-Request-Id", requestId);
    headers.set("traceparent", traceparent);
    const user = await requireAuth(new Request(context.request.clone(), { headers }), context.env);
    context.data = { ...context.data, user, requestId, traceparent };
    return correlateResponse(await context.next(), requestId, traceparent);
  } catch (error) {
    if (error instanceof AuthError) {
      return correlateResponse(
        jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
          code: error.code,
          requestId,
        }),
        requestId,
        traceparent,
      );
    }
    logCertificateFailure(error, { requestId, operation: "list" });
    return correlateResponse(
      jsonError("Certificate service temporarily unavailable", 503, {
        code: "CERTIFICATE_UNAVAILABLE",
        requestId,
      }),
      requestId,
      traceparent,
    );
  }
}
