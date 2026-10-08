import { credentialIdSchema } from "@functions/lib/certificates/credential-id";
import { certificateError, ownerId, summary } from "@functions/lib/certificates/http";
import { certificateOwnerReadPolicy } from "@functions/lib/certificates/queries";
import type { CertificateRow } from "@functions/lib/certificates/types";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
import { certificateSummarySchema } from "../schemas";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const userId = ownerId(context);
    const credentialId = credentialIdSchema.parse(context.params["credentialId"]);
    const row = await createServiceQueryGateway(context.env).read<CertificateRow | null>(
      certificateOwnerReadPolicy,
      {
        auth: { userId },
        filters: [{ column: "credential_id", op: "eq", value: credentialId }],
        result: "maybeSingle",
      },
    );
    if (!row) return jsonError("Certificate not found", 404, { code: "NOT_FOUND", requestId });
    return jsonResponse(certificateSummarySchema.parse(summary(row, context.env)), {
      headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId },
    });
  } catch (error) {
    return certificateError(error, requestId);
  }
}
