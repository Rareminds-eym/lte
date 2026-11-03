import type { CertificateRow } from "@functions/lib/certificates";
import {
  certificateError,
  certificateOwnerReadPolicy,
  certificatePdf,
  certificateRequestContext,
  correlateResponse,
  credentialIdSchema,
  limitRequest,
  ownerId,
} from "@functions/lib/certificates";
import { jsonError } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { requestId, traceparent } = certificateRequestContext(context);
  try {
    const userId = ownerId(context);
    const credentialId = credentialIdSchema.parse(context.params["credentialId"]);
    const limited = await limitRequest(context, userId, "certificate-download", 10, requestId);
    if (limited) return limited;
    const qb = createServiceQueryGateway(context.env, { requestId, traceparent });
    const row = await qb.read<CertificateRow | null>(certificateOwnerReadPolicy, {
      auth: { userId },
      filters: [{ column: "credential_id", op: "eq", value: credentialId }],
      result: "maybeSingle",
    });
    if (!row) return jsonError("Certificate not found", 404, { code: "NOT_FOUND", requestId });
    return await certificatePdf(qb, context.env, row, requestId, traceparent);
  } catch (error) {
    return correlateResponse(certificateError(error, requestId), requestId, traceparent);
  }
}
