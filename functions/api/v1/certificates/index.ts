import { certificateError, limitRequest, ownerId, summary } from "@functions/lib/certificates/http";
import { logCertificateFailure } from "@functions/lib/certificates/logging";
import { certificateOwnerReadPolicy, readAll } from "@functions/lib/certificates/queries";
import { ensureCertificatesForUser } from "@functions/lib/certificates/reconcile";
import type { CertificateRow } from "@functions/lib/certificates/types";
import { jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
import { listQuerySchema, listResponseSchema } from "./schemas";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const userId = ownerId(context);
    const limited = await limitRequest(context, userId, "certificates", 60, requestId);
    if (limited) return limited;
    const query = listQuerySchema.parse(
      Object.fromEntries(new URL(context.request.url).searchParams),
    );
    const qb = createServiceQueryGateway(context.env);
    try {
      await ensureCertificatesForUser(qb, { requestId }, userId);
    } catch (error) {
      logCertificateFailure(error, { requestId, userId, operation: "list_reconcile" });
    }
    const filters = [
      ...(query.type ? [{ column: "certificate_type", op: "eq" as const, value: query.type }] : []),
      ...(query.levelId ? [{ column: "level_id", op: "eq" as const, value: query.levelId }] : []),
    ];
    const rows = await readAll<CertificateRow>(qb, certificateOwnerReadPolicy, {
      auth: { userId },
      filters,
      sort: [
        { column: "created_at", ascending: false },
        { column: "id", ascending: true },
      ],
    });
    return jsonResponse(
      listResponseSchema.parse({ certificates: rows.map((row) => summary(row, context.env)) }),
      { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return certificateError(error, requestId);
  }
}
