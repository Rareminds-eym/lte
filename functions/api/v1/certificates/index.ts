import type { CertificateRow } from "@functions/lib/certificates";
import {
  CERTIFICATE_CONFIG,
  certificateError,
  certificateOwnerReadPolicy,
  certificateRequestContext,
  correlationHeaders,
  drainCertificateStorageCleanup,
  ensureCertificatesForUser,
  limitRequest,
  logCertificateFailure,
  ownerId,
  parseCertificateData,
  readAll,
  summary,
} from "@functions/lib/certificates";
import { jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
import { listQuerySchema, listResponseSchema } from "@functions/schemas";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const correlation = certificateRequestContext(context);
  const { requestId, traceparent } = correlation;
  try {
    const userId = ownerId(context);
    const limited = await limitRequest(
      context,
      userId,
      "certificates",
      CERTIFICATE_CONFIG.listRateLimit,
      requestId,
    );
    if (limited) return limited;
    const query = listQuerySchema.parse(
      Object.fromEntries(new URL(context.request.url).searchParams),
    );
    const qb = createServiceQueryGateway(context.env, { requestId, traceparent });
    context.waitUntil(
      drainCertificateStorageCleanup(qb, context.env, requestId).catch((error) => {
        logCertificateFailure(error, { requestId, operation: "storage_cleanup" });
      }),
    );
    try {
      await ensureCertificatesForUser(qb, correlation, userId);
    } catch (error) {
      logCertificateFailure(error, { requestId, userId, operation: "reconcile" });
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
      parseCertificateData(listResponseSchema, {
        certificates: rows.map((row) => summary(row, context.env)),
      }),
      {
        headers: {
          "Cache-Control": "private, no-store",
          ...correlationHeaders(requestId, traceparent),
        },
      },
    );
  } catch (error) {
    const response = certificateError(error, requestId);
    for (const [key, value] of Object.entries(correlationHeaders(requestId, traceparent)))
      response.headers.set(key, value);
    return response;
  }
}
