import type { CertificateRow } from "@functions/lib/certificates";
import {
  certificateError,
  certificateOwnerReadPolicy,
  certificateRequestContext,
  correlateResponse,
  correlationHeaders,
  credentialIdSchema,
  ownerId,
  parseCertificateData,
  summary,
} from "@functions/lib/certificates";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
import { certificateSummarySchema } from "@functions/schemas";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { requestId, traceparent } = certificateRequestContext(context);
  try {
    const userId = ownerId(context);
    const credentialId = credentialIdSchema.parse(context.params["credentialId"]);
    const row = await createServiceQueryGateway(context.env, {
      requestId,
      traceparent,
    }).read<CertificateRow | null>(certificateOwnerReadPolicy, {
      auth: { userId },
      filters: [{ column: "credential_id", op: "eq", value: credentialId }],
      result: "maybeSingle",
    });
    if (!row)
      return correlateResponse(
        jsonError("Certificate not found", 404, { code: "NOT_FOUND", requestId }),
        requestId,
        traceparent,
      );
    return jsonResponse(parseCertificateData(certificateSummarySchema, summary(row, context.env)), {
      headers: {
        "Cache-Control": "private, no-store",
        ...correlationHeaders(requestId, traceparent),
      },
    });
  } catch (error) {
    return correlateResponse(certificateError(error, requestId), requestId, traceparent);
  }
}
