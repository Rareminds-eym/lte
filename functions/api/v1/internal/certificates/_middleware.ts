import {
  certificateRequestContext,
  correlateResponse,
  internalError,
  internalErrorResponse,
  limitRequest,
  logCertificateFailure,
} from "@functions/lib/certificates";
import { verifyServiceToken } from "@functions/lib/serviceToken";
import type { PagesContext } from "@functions/lib/types";
import { extractBearerToken } from "@functions/middleware";
export async function onRequest(context: PagesContext): Promise<Response> {
  let requestId: string = crypto.randomUUID();
  let traceparent: string;
  try {
    const correlation = certificateRequestContext(context);
    requestId = correlation.requestId;
    traceparent = correlation.traceparent;
    context.data = {
      ...context.data,
      requestId,
      traceparent: correlation.traceparent,
    };
  } catch (error) {
    logCertificateFailure(error, { requestId, operation: "list" });
    return internalError(
      "CERTIFICATE_UNAVAILABLE",
      "Service temporarily unavailable",
      503,
      requestId,
    );
  }

  const respond = (response: Response) => correlateResponse(response, requestId, traceparent);
  let claims: Awaited<ReturnType<typeof verifyServiceToken>>;
  try {
    const token = extractBearerToken(context.request);
    if (!token) throw new Error("Missing service token");
    claims = await verifyServiceToken(context.env.SKILLPASSPORT_INTERNAL_SECRET, token);
  } catch {
    return respond(internalError("UNAUTHORIZED", "Invalid service token", 401, requestId));
  }
  const maintenance =
    new URL(context.request.url).pathname === "/api/v1/internal/certificates/cleanup";
  const expectedApp = maintenance ? "lte-maintenance" : "skillpassport";
  const expectedAction = maintenance ? "certificates.cleanup" : "certificates.read";
  if (claims.app !== expectedApp || !claims.actions.includes(expectedAction))
    return respond(internalError("FORBIDDEN", "Service action is not permitted", 403, requestId));

  try {
    const limited = await limitRequest(context, claims.app, "certificate-internal", 600, requestId);
    if (limited) return respond(await internalErrorResponse(limited));
  } catch (error) {
    logCertificateFailure(error, { requestId, operation: "rate_limit" });
    return respond(
      internalError("RATE_LIMIT_UNAVAILABLE", "Service temporarily unavailable", 503, requestId),
    );
  }
  context.data = { ...context.data, certificateServiceApp: claims.app };
  return respond(await context.next());
}
