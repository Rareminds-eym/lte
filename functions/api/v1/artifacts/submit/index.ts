import {
  ARTIFACT_LIMITS,
  logMetricsSnapshot,
  METRIC,
  metrics,
} from "@functions/lib/artifact-evaluator";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getAuthUser, rateLimitErrorResponse, rateLimiter } from "@functions/middleware";
import { completeSubmissionSchema } from "@functions/schemas";
import { apiLogger } from "@functions/shared/logger";
import { ArtifactSubmissionError, submitArtifactSubmission } from "../queries";

type GuardResult = { ok: true } | { ok: false; response: Response };

/**
 * Phase 3: early guards for the multipart body. `request.formData()` buffers
 * the whole body, so anything checkable before/without that allocation is
 * rejected first. Content-Length is advisory (chunked bodies may omit it);
 * file count/cumulative size are authoritative after parsing.
 */
function assertRequestWithinLimits(request: Request, requestId: string): GuardResult {
  const contentLengthHeader = request.headers.get("Content-Length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > ARTIFACT_LIMITS.maxRequestBytes) {
      return {
        ok: false,
        response: jsonError("The submission request is larger than the allowed size.", 413, {
          code: "PAYLOAD_TOO_LARGE",
          requestId,
        }),
      };
    }
  }
  return { ok: true };
}

function readSubmissionPayload(
  formData: FormData,
  requestId: string,
): GuardResult & { files?: Map<string, File> } {
  const files = new Map<string, File>();
  let cumulativeSize = 0;
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("file:") && value instanceof File) {
      files.set(key.slice("file:".length), value);
      cumulativeSize += value.size;
    }
  }

  if (files.size > ARTIFACT_LIMITS.maxFilesPerSubmission) {
    return {
      ok: false,
      response: jsonError("Too many files in one submission.", 413, {
        code: "PAYLOAD_TOO_LARGE",
        requestId,
      }),
    };
  }
  if (cumulativeSize > ARTIFACT_LIMITS.maxRequestBytes) {
    return {
      ok: false,
      response: jsonError("The uploaded files exceed the allowed total size.", 413, {
        code: "PAYLOAD_TOO_LARGE",
        requestId,
      }),
    };
  }
  return { ok: true, files };
}

/**
 * Streams the request body with a hard byte cap. Content-Length is advisory
 * (chunked bodies omit it) and `request.formData()`/`request.json()` buffer
 * the whole body before any check, so a declared-less or chunked oversized
 * body would otherwise be fully buffered before the cumulative cap runs.
 * Reading with a capped reader aborts at `maxRequestBytes`, bounding memory.
 */
async function readBodyWithCap(request: Request): Promise<ArrayBuffer> {
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > ARTIFACT_LIMITS.maxRequestBytes) {
      await reader.cancel();
      throw new ArtifactSubmissionError(
        "The submission request is larger than the allowed size.",
        413,
        "PAYLOAD_TOO_LARGE",
      );
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    const user = getAuthUser(context);
    if (!user) {
      return jsonError("Unauthorized", 401, { code: "UNAUTHORIZED", requestId });
    }
    metrics.inc(METRIC.SUBMISSION_RECEIVED);

    // Per-authenticated-user sliding-window rate limit (Phase 3). In-memory
    // per-isolate: adequate against single-user abuse, documented in
    // docs/architecture/artifact-evaluation-production-hardening.md.
    const rate = rateLimiter.check(
      `artifact-submit:${user.sub}`,
      ARTIFACT_LIMITS.rateLimitMax,
      ARTIFACT_LIMITS.rateLimitWindowMs,
    );
    if (!rate.allowed) {
      metrics.inc(METRIC.RATE_LIMIT_HITS);
      return rateLimitErrorResponse(requestId, rate.retryAfterMs);
    }

    const sizeCheck = assertRequestWithinLimits(context.request, requestId);
    if (!sizeCheck.ok) {
      metrics.inc(METRIC.VALIDATION_FAILED);
      return sizeCheck.response;
    }

    let formData: FormData;
    let payload: string;
    try {
      const contentType = context.request.headers.get("Content-Type") ?? "";
      const bytes = await readBodyWithCap(context.request);
      if (!contentType.includes("multipart/form-data")) {
        payload = new TextDecoder().decode(bytes);
        formData = new FormData();
      } else {
        formData = await new Response(bytes, {
          headers: { "Content-Type": contentType },
        }).formData();
        const raw = formData.get("payload");
        if (typeof raw !== "string") {
          throw new ArtifactSubmissionError(
            "Submission payload is required.",
            400,
            "PAYLOAD_REQUIRED",
          );
        }
        payload = raw;
      }
    } catch (error) {
      metrics.inc(METRIC.VALIDATION_FAILED);
      if (error instanceof ArtifactSubmissionError) {
        return jsonError(error.message, error.status, { code: error.code, requestId });
      }
      return jsonError("The submission body could not be read.", 400, {
        code: "INVALID_MULTIPART",
        requestId,
      });
    }

    const fileCheck = readSubmissionPayload(formData, requestId);
    if (!fileCheck.ok) {
      metrics.inc(METRIC.VALIDATION_FAILED);
      return fileCheck.response;
    }
    const filesByQuestionId = fileCheck.files ?? new Map<string, File>();

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      metrics.inc(METRIC.VALIDATION_FAILED);
      return jsonError("The submission payload is not valid JSON.", 400, {
        code: "INVALID_JSON",
        requestId,
      });
    }

    const parsed = completeSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      metrics.inc(METRIC.VALIDATION_FAILED);
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid submission request", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    // P0-2: optional client-supplied idempotency key so retried requests
    // return the original submission instead of creating duplicates.
    const idempotencyKey = context.request.headers.get("Idempotency-Key")?.trim() || undefined;
    if (idempotencyKey && idempotencyKey.length > 128) {
      metrics.inc(METRIC.VALIDATION_FAILED);
      return jsonError("Idempotency-Key header is too long.", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const qb = createServiceQueryGateway(context.env);
    const result = await submitArtifactSubmission(
      qb,
      context.env,
      user.sub,
      parsed.data,
      filesByQuestionId,
      idempotencyKey,
    );
    return jsonResponse({ success: true, ...result });
  } catch (error) {
    if (error instanceof ArtifactSubmissionError) {
      if (error.status >= 400 && error.status < 500) metrics.inc(METRIC.VALIDATION_FAILED);
      return jsonError(error.message, error.status, { code: error.code, requestId });
    }

    apiLogger.error("Failed to submit artifact", error, {
      requestId,
      artifactId:
        typeof error === "object" && error !== null
          ? (error as { artifactId?: string }).artifactId
          : undefined,
    });
    return jsonError("Failed to submit artifact.", 500, {
      code: "SERVER_ERROR",
      requestId,
    });
  } finally {
    // Structured per-request metrics snapshot (no PII), best-effort background.
    context.waitUntil(
      Promise.resolve().then(() => logMetricsSnapshot({ endpoint: "artifacts/submit", requestId })),
    );
  }
}
