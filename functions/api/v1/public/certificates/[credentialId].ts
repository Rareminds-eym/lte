import { verifyResponseSchema } from "@functions/api/v1/certificates/schemas";
import { credentialIdSchema } from "@functions/lib/certificates/credential-id";
import { certificateError, limitRequest } from "@functions/lib/certificates/http";
import { certificateLogger } from "@functions/lib/certificates/logging";
import { certificatePublicReadPolicy } from "@functions/lib/certificates/queries";
import type { CertificateRow } from "@functions/lib/certificates/types";
import { jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";

function cors(context: PagesContext, response: Response): Response {
  response.headers.set("Vary", "Origin");
  if (
    context.request.headers.get("Origin") === new URL(context.env.SKILLPASSPORT_INTERNAL_URL).origin
  ) {
    response.headers.set(
      "Access-Control-Allow-Origin",
      new URL(context.env.SKILLPASSPORT_INTERNAL_URL).origin,
    );
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Expose-Headers", "Retry-After");
  }
  return response;
}
export function onRequestOptions(context: PagesContext): Response {
  return cors(context, new Response(null, { status: 204 }));
}
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const limited = await limitRequest(
      context,
      context.request.headers.get("CF-Connecting-IP") ?? "unknown",
      "certificate-verify",
      60,
      requestId,
    );
    if (limited) return cors(context, limited);
    const credentialId = credentialIdSchema.parse(context.params["credentialId"]);
    const row = await createServiceQueryGateway(context.env).read<CertificateRow | null>(
      certificatePublicReadPolicy,
      {
        filters: [{ column: "credential_id", op: "eq", value: credentialId }],
        result: "maybeSingle",
      },
    );
    const base = { credentialId, issuer: "Rareminds LTE" as const };
    const body = verifyResponseSchema.parse(
      row?.status === "issued"
        ? {
            ...base,
            status: "valid",
            certificateType: row.certificate_type,
            learnerName: row.learner_name,
            title: row.title,
            subtitle: row.subtitle,
            levelLabel: row.level_label,
            badge: row.badge,
            completionDate: row.completion_date,
            issuedAt: row.issued_at,
          }
        : row?.status === "revoked"
          ? { ...base, status: "revoked", revokedAt: row.revoked_at }
          : { ...base, status: "not_found" },
    );
    certificateLogger.info("certificate.verify", { requestId, outcome: body.status });
    return cors(
      context,
      jsonResponse(body, {
        headers: { "Cache-Control": "public, max-age=60", "X-Request-Id": requestId },
      }),
    );
  } catch (error) {
    return cors(context, certificateError(error, requestId));
  }
}
