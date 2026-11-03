import type { CertificateRow } from "@functions/lib/certificates";
import {
  certificateError,
  certificateInternalReadPolicy,
  certificatePdf,
  certificateRequestContext,
  correlateResponse,
  credentialIdSchema,
  internalError,
  internalErrorResponse,
  limitRequest,
} from "@functions/lib/certificates";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const fallback = certificateRequestContext(context);
  const requestId = String(context.data?.["requestId"] ?? fallback.requestId);
  const traceparent = String(context.data?.["traceparent"] ?? fallback.traceparent);
  if (context.data?.["certificateServiceApp"] !== "skillpassport")
    return internalError("UNAUTHORIZED", "Service authentication required", 401, requestId);
  try {
    const credentialId = credentialIdSchema.parse(context.params["credentialId"]);
    const qb = createServiceQueryGateway(context.env, { requestId, traceparent });
    const row = await qb.read<CertificateRow | null>(certificateInternalReadPolicy, {
      filters: [{ column: "credential_id", op: "eq", value: credentialId }],
      result: "maybeSingle",
    });
    if (!row) return internalError("NOT_FOUND", "Certificate not found", 404, requestId);
    const limited = await limitRequest(context, row.user_id, "certificate-download", 10, requestId);
    if (limited) return internalErrorResponse(limited);
    return await certificatePdf(qb, context.env, row, requestId, traceparent);
  } catch (error) {
    return correlateResponse(
      await internalErrorResponse(certificateError(error, requestId)),
      requestId,
      traceparent,
    );
  }
}
