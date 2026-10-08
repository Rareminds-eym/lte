import { limitRequest } from "@functions/lib/certificates/http";
import { internalError, internalErrorResponse } from "@functions/lib/certificates/internal";
import { verifyServiceToken } from "@functions/lib/internal-service-token";
import type { PagesContext } from "@functions/lib/types";
export async function onRequest(context: PagesContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const authorization = context.request.headers.get("Authorization");
  let claims: Awaited<ReturnType<typeof verifyServiceToken>>;
  try {
    if (!authorization?.startsWith("Bearer ")) throw new Error("Missing token");
    claims = await verifyServiceToken(
      context.env.SKILLPASSPORT_INTERNAL_SECRET,
      authorization.slice(7),
    );
  } catch {
    return internalError("UNAUTHORIZED", "Invalid service token", 401, requestId);
  }
  if (claims.app !== "skillpassport" || !claims.actions.includes("certificates.read"))
    return internalError("FORBIDDEN", "Service action is not permitted", 403, requestId);
  try {
    const limited = await limitRequest(context, claims.app, "certificate-internal", 600, requestId);
    if (limited) return internalErrorResponse(limited);
    context.data = { ...context.data, certificateServiceApp: claims.app, requestId };
    return context.next();
  } catch {
    return internalError(
      "RATE_LIMIT_UNAVAILABLE",
      "Service temporarily unavailable",
      503,
      requestId,
    );
  }
}
