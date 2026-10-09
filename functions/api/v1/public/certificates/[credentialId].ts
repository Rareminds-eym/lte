import type { CertificateRow } from "@functions/lib/certificates";
import {
  CERTIFICATE_CONFIG,
  certificateError,
  certificateLogger,
  certificatePublicReadPolicy,
  certificateRequestContext,
  correlateResponse,
  credentialIdSchema,
  limitRequest,
  parseCertificateData,
} from "@functions/lib/certificates";
import { jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
import { verifyResponseSchema } from "@functions/schemas";
import { z } from "zod";

function allowedOrigin(context: PagesContext): string | null {
  const parsed = z.url().safeParse(context.env.SKILLPASSPORT_INTERNAL_URL);
  if (!parsed.success) return null;
  return new URL(parsed.data).origin;
}

function cors(context: PagesContext, response: Response): Response {
  response.headers.set("Vary", "Origin");
  const origin = allowedOrigin(context);
  if (origin && context.request.headers.get("Origin") === origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Expose-Headers", "Retry-After");
  }
  return response;
}
export function onRequestOptions(context: PagesContext): Response {
  const { requestId, traceparent } = certificateRequestContext(context);
  return cors(
    context,
    correlateResponse(new Response(null, { status: 204 }), requestId, traceparent),
  );
}
export async function onRequestGet(context: PagesContext): Promise<Response> {
  let requestId: string = crypto.randomUUID();
  let traceparent: string = `00-${crypto.randomUUID().replaceAll("-", "")}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}-01`;
  try {
    const correlation = certificateRequestContext(context);
    requestId = correlation.requestId;
    traceparent = correlation.traceparent;
    const limited = await limitRequest(
      context,
      context.request.headers.get("CF-Connecting-IP") ?? "unknown",
      "certificate-verify",
      CERTIFICATE_CONFIG.publicRateLimit,
      requestId,
    );
    if (limited) return cors(context, limited);
    const credentialId = credentialIdSchema.parse(context.params["credentialId"]);
    const row = await createServiceQueryGateway(context.env, {
      requestId,
      traceparent,
    }).read<CertificateRow | null>(certificatePublicReadPolicy, {
      filters: [{ column: "credential_id", op: "eq", value: credentialId }],
      result: "maybeSingle",
    });
    const base = { credentialId, issuer: "Rareminds LTE" as const };
    if (!row || row.status === "pending_name") {
      certificateLogger.info("certificate.verify", { requestId, outcome: "not_found" });
      return cors(
        context,
        correlateResponse(
          jsonResponse(
            parseCertificateData(verifyResponseSchema, {
              ...base,
              status: "not_found",
            }),
            {
              status: 404,
              headers: {
                "Cache-Control": `public, max-age=${CERTIFICATE_CONFIG.verifyCacheSeconds}`,
              },
            },
          ),
          requestId,
          traceparent,
        ),
      );
    }
    const body = parseCertificateData(
      verifyResponseSchema,
      row.status === "issued"
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
        : { ...base, status: "revoked", revokedAt: row.revoked_at },
    );
    certificateLogger.info("certificate.verify", { requestId, outcome: body.status });
    return cors(
      context,
      correlateResponse(
        jsonResponse(body, {
          headers: { "Cache-Control": `public, max-age=${CERTIFICATE_CONFIG.verifyCacheSeconds}` },
        }),
        requestId,
        traceparent,
      ),
    );
  } catch (error) {
    return cors(
      context,
      correlateResponse(certificateError(error, requestId), requestId, traceparent),
    );
  }
}
