import { credentialIdSchema } from "@functions/lib/certificates/credential-id";
import { certificateError, limitRequest } from "@functions/lib/certificates/http";
import { internalError, internalErrorResponse } from "@functions/lib/certificates/internal";
import { certificateInternalReadPolicy } from "@functions/lib/certificates/queries";
import { certificatePdf } from "@functions/lib/certificates/storage";
import type { CertificateRow } from "@functions/lib/certificates/types";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const requestId = String(context.data?.["requestId"] ?? crypto.randomUUID());
  if (context.data?.["certificateServiceApp"] !== "skillpassport")
    return internalError("UNAUTHORIZED", "Service authentication required", 401, requestId);
  try {
    const credentialId = credentialIdSchema.parse(context.params["credentialId"]);
    const qb = createServiceQueryGateway(context.env);
    const row = await qb.read<CertificateRow | null>(certificateInternalReadPolicy, {
      filters: [{ column: "credential_id", op: "eq", value: credentialId }],
      result: "maybeSingle",
    });
    if (!row) return internalError("NOT_FOUND", "Certificate not found", 404, requestId);
    const limited = await limitRequest(context, row.user_id, "certificate-download", 10, requestId);
    if (limited) return internalErrorResponse(limited);
    return await certificatePdf(qb, context.env, row, requestId);
  } catch (error) {
    return internalErrorResponse(certificateError(error, requestId));
  }
}
