import { credentialIdSchema } from "@functions/lib/certificates/credential-id";
import { certificateError, limitRequest, ownerId } from "@functions/lib/certificates/http";
import { certificateOwnerReadPolicy } from "@functions/lib/certificates/queries";
import { certificatePdf } from "@functions/lib/certificates/storage";
import type { CertificateRow } from "@functions/lib/certificates/types";
import { jsonError } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const userId = ownerId(context);
    const credentialId = credentialIdSchema.parse(context.params["credentialId"]);
    const limited = await limitRequest(context, userId, "certificate-download", 10, requestId);
    if (limited) return limited;
    const qb = createServiceQueryGateway(context.env);
    const row = await qb.read<CertificateRow | null>(certificateOwnerReadPolicy, {
      auth: { userId },
      filters: [{ column: "credential_id", op: "eq", value: credentialId }],
      result: "maybeSingle",
    });
    if (!row) return jsonError("Certificate not found", 404, { code: "NOT_FOUND", requestId });
    return await certificatePdf(qb, context.env, row, requestId);
  } catch (error) {
    return certificateError(error, requestId);
  }
}
