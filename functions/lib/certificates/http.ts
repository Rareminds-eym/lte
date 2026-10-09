import { validateBackendEnv } from "@functions/lib/env";
import { jsonError } from "@functions/lib/http";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { requestCorrelation } from "@functions/middleware";
import { getAuthUser } from "@functions/middleware/auth";
import { checkDistributedRateLimit } from "@functions/middleware/distributed-rate-limiter";
import { rateLimitErrorResponse } from "@functions/middleware/rate-limiter";
import { z } from "zod";
import { logCertificateFailure, wasCertificateErrorLogged } from "./logging";
import {
  PdfRenderRateLimitedError,
  PdfRenderTimeoutError,
  PdfRenderUpstreamError,
} from "./pdfRenderer";
import { CertificateDownloadError } from "./storage";
import { verifyUrl } from "./template";
import type { CertificateRow } from "./types";

export function certificateRequestContext(context: PagesContext): {
  requestId: string;
  traceparent: string;
} {
  validateBackendEnv(context.env);
  return requestCorrelation(context.request, context.data);
}

export function correlationHeaders(requestId: string, traceparent: string): HeadersInit {
  return { "X-Request-Id": requestId, traceparent };
}

export function correlateResponse(
  response: Response,
  requestId: string,
  traceparent: string,
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-Id", requestId);
  headers.set("traceparent", traceparent);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export function summary(row: CertificateRow, env: LteEnv) {
  return {
    credentialId: row.credential_id,
    certificateType: row.certificate_type,
    status: row.status,
    title: row.title,
    subtitle: row.subtitle,
    levelLabel: row.level_label,
    badge: row.badge,
    completionDate: row.completion_date,
    issuedAt: row.issued_at,
    levelId: row.level_id,
    roleId: row.role_id,
    verifyUrl:
      row.status === "issued"
        ? verifyUrl(env.CERTIFICATE_VERIFY_BASE_URL!, row.credential_id)
        : null,
    downloadable: row.status === "issued",
  };
}
export function ownerId(context: PagesContext): string {
  const user = getAuthUser(context);
  if (!user) throw new CertificateDownloadError(401, "UNAUTHORIZED");
  return user.sub;
}
export async function limitRequest(
  context: PagesContext,
  key: string,
  namespace: string,
  limit: number,
  requestId: string,
) {
  const result = await checkDistributedRateLimit(context.env.RATE_LIMIT_KV, key, {
    namespace,
    limit,
    windowSeconds: 60,
  });
  return result.allowed
    ? null
    : rateLimitErrorResponse(
        requestId,
        result.retryAfterMs,
        "Too many requests. Please wait before retrying.",
      );
}
export function certificateError(error: unknown, requestId: string): Response {
  if (error instanceof z.ZodError)
    return jsonError("Invalid request", 400, { code: "VALIDATION_ERROR", requestId });
  if (error instanceof CertificateDownloadError)
    return jsonError(error.code, error.status, { code: error.code, requestId });
  if (error instanceof PdfRenderRateLimitedError)
    return jsonError("PDF is busy. Please retry shortly.", 503, {
      code: "PDF_RENDER_BUSY",
      requestId,
      details: { retryAfterMs: error.retryAfterSeconds * 1000 },
      headers: { "Retry-After": String(error.retryAfterSeconds) },
    });
  if (error instanceof PdfRenderTimeoutError || error instanceof PdfRenderUpstreamError)
    return jsonError("PDF is temporarily unavailable.", 503, {
      code: "PDF_RENDER_UNAVAILABLE",
      requestId,
    });
  if (!wasCertificateErrorLogged(error))
    logCertificateFailure(error, { requestId, operation: "list" });
  return jsonError("Certificate service temporarily unavailable", 503, {
    code: "CERTIFICATE_UNAVAILABLE",
    requestId,
  });
}
