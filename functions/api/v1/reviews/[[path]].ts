import { getObjectKeyFromFileUrl } from "@functions/api/v1/artifacts/file-queries";
import { sanitizeContentDispositionFilename } from "@functions/lib/artifact-evaluator";
import { jsonError, jsonResponse } from "@functions/lib/http";
import {
  completionHash,
  completionSchema,
  idempotencyKeySchema,
  normalizeCompletion,
  startSchema,
} from "@functions/lib/human-review/contracts";
import {
  adminOverview,
  adminReviewDetail,
  assignReview,
  REVIEW_VIEWS,
} from "@functions/lib/human-review/operations";
import {
  assertActiveReviewer,
  assertAssignmentScope,
  assignmentPolicy,
  assignmentSchema,
  ReviewError,
  requireAssignment,
  reviewRpc,
} from "@functions/lib/human-review/service";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getAuthUser, rateLimitErrorResponse, rateLimiter } from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";
import { getReviewDetail } from "./queries";

async function readCommand(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ReviewError("JSON body required", 400, "INVALID_BODY");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new ReviewError("Review body too large", 413, "BODY_TOO_LARGE");
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ReviewError("Invalid JSON body", 400, "INVALID_BODY");
  }
}

export async function onRequest(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = getAuthUser(context);
    if (!user) return jsonError("Unauthorized", 401, { code: "UNAUTHORIZED", requestId });
    const rate = rateLimiter.check(`reviews:${user.sub}`, 60, 60_000);
    if (!rate.allowed) return rateLimitErrorResponse(requestId, rate.retryAfterMs);
    const qb = createServiceQueryGateway(context.env);
    const url = new URL(context.request.url);
    const parts = url.pathname
      .replace(/^\/api\/v1\/reviews\/?/, "")
      .split("/")
      .filter(Boolean);
    const method = context.request.method;
    if (parts.length === 1 && (parts[0] === "queue" || parts[0] === "stats") && method === "GET") {
      await assertActiveReviewer(context.env, user.sub);
      const cursor = url.searchParams.get("cursor");
      if (cursor && (cursor.length > 512 || !/^[A-Za-z0-9+/=]+$/.test(cursor)))
        throw new ReviewError("Invalid cursor", 400, "INVALID_CURSOR");
      let after: { due: string; id: string } | null = null;
      if (cursor) {
        try {
          after = z
            .object({ due: z.iso.datetime({ offset: true }), id: z.uuid() })
            .strict()
            .parse(JSON.parse(atob(cursor)));
        } catch {
          throw new ReviewError("Invalid cursor", 400, "INVALID_CURSOR");
        }
      }
      const raw = z.array(assignmentSchema).parse(
        parts[0] === "stats"
          ? await qb.read(assignmentPolicy, {
              filters: [
                { column: "reviewer_id", op: "eq", value: user.sub },
                { column: "status", op: "in", value: ["pending", "in_progress"] },
              ],
              pageSize: 100,
            })
          : await reviewRpc(qb, "list_artifact_review_queue", {
              p_actor_id: user.sub,
              p_after_due: after?.due ?? null,
              p_after_id: after?.id ?? null,
              p_limit: 26,
            }),
      );
      const pageRows = parts[0] === "stats" ? raw : raw.slice(0, 25);
      const items = [];
      for (let offset = 0; offset < pageRows.length; offset += 10) {
        const authorized = await Promise.all(
          pageRows.slice(offset, offset + 10).map(async (row) => {
            try {
              await assertAssignmentScope(context.env, row, user.sub);
              return row;
            } catch (error) {
              if (error instanceof ReviewError && [403, 404].includes(error.status)) return null;
              throw error;
            }
          }),
        );
        items.push(...authorized.filter((row) => row !== null));
      }
      if (parts[0] === "stats")
        return jsonResponse({
          success: true,
          pending: items.filter((r) => r.status === "pending").length,
          inProgress: items.filter((r) => r.status === "in_progress").length,
          overdue: items.filter((r) => r.due_by && Date.parse(r.due_by) < Date.now()).length,
          truncated: raw.length === 100,
        });
      const last = pageRows.at(-1);
      const nextCursor =
        raw.length > 25 && last ? btoa(JSON.stringify({ due: last.due_by, id: last.id })) : null;
      return jsonResponse({ success: true, items, nextCursor, hasMore: nextCursor !== null });
    }
    if (parts[0] === "operations") {
      if (parts.length === 2 && parts[1] === "overview" && method === "GET") {
        const query = z
          .object({
            view: z.enum(REVIEW_VIEWS).default("all"),
            q: z.string().trim().max(100).default(""),
            page: z.coerce.number().int().min(1).max(1000).default(1),
          })
          .parse({
            view: url.searchParams.get("view") ?? undefined,
            q: url.searchParams.get("q") ?? undefined,
            page: url.searchParams.get("page") ?? undefined,
          });
        return jsonResponse(await adminOverview(qb, context.env, user.sub, query));
      }
      const reviewId = z.uuid().parse(parts[1]);
      if (parts.length === 2 && method === "GET")
        return jsonResponse(await adminReviewDetail(qb, context.env, user.sub, reviewId));
      if (parts.length === 3 && parts[2] === "reassign" && method === "POST")
        return jsonResponse({
          review: await assignReview(
            qb,
            context.env,
            user.sub,
            reviewId,
            await readCommand(context.request),
          ),
        });
      return jsonError("Not found", 404, { code: "NOT_FOUND", requestId });
    }
    const id = z.uuid().parse(parts[0]);
    const review = await requireAssignment(qb, context.env, id, user.sub);
    if (parts.length === 1 && method === "GET")
      return jsonResponse({ success: true, ...(await getReviewDetail(qb, review)) });
    if (parts.length === 4 && parts[1] === "files" && parts[3] === "download" && method === "GET") {
      const fileId = z.uuid().parse(parts[2]);
      const file = (await qb.read(
        {
          table: "artifact_submission_files",
          operation: "read",
          columns: ["object_key", "file_url", "file_name"],
          filters: ["id", "submission_id"],
        },
        {
          filters: [
            { column: "id", op: "eq", value: fileId },
            { column: "submission_id", op: "eq", value: review.submission_id },
          ],
          result: "maybeSingle",
        },
      )) as { object_key: string | null; file_url: string | null; file_name: string } | null;
      const objectKey =
        file?.object_key ?? (file?.file_url ? getObjectKeyFromFileUrl(file.file_url) : null);
      if (!file || !objectKey) throw new ReviewError("File not found", 404, "FILE_NOT_FOUND");
      const object = (await context.env.STORAGE_BUCKET.get(objectKey)) as {
        body?: BodyInit;
      } | null;
      if (!object?.body) throw new ReviewError("File not found", 404, "FILE_NOT_FOUND");
      return new Response(object.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="${sanitizeContentDispositionFilename(file.file_name)}"`,
        },
      });
    }
    if (parts.length === 2 && method === "POST") {
      const body = await readCommand(context.request);
      if (parts[1] === "start") {
        const command = startSchema.parse(body);
        return jsonResponse({
          success: true,
          review: await reviewRpc(qb, "start_artifact_review", {
            p_review_id: id,
            p_actor_id: user.sub,
            p_version: command.expectedVersion,
          }),
        });
      }
      if (parts[1] === "complete" || parts[1] === "return") {
        const command = completionSchema.parse(body);
        if (parts[1] === "return" && command.decision !== "revise_and_resubmit")
          throw new ReviewError("Return requires revision", 400, "INVALID_DECISION");
        const key = idempotencyKeySchema.parse(context.request.headers.get("Idempotency-Key"));
        const result = await reviewRpc(qb, "complete_artifact_review", {
          p_review_id: id,
          p_actor_id: user.sub,
          p_key: key,
          p_hash: await completionHash(command),
          p_command: normalizeCompletion(command),
        });
        return jsonResponse({ success: true, ...(result as Record<string, unknown>) });
      }
    }
    return jsonError("Not found", 404, { code: "NOT_FOUND", requestId });
  } catch (error) {
    if (error instanceof z.ZodError)
      return jsonError(error.issues[0]?.message ?? "Invalid request", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    if (error instanceof ReviewError)
      return jsonError(error.message, error.status, { code: error.code, requestId });
    apiLogger.error("Review request failed", error, { requestId });
    return jsonError("Review service unavailable", 503, { code: "REVIEW_UNAVAILABLE", requestId });
  }
}
