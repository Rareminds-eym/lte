import { getObjectKeyFromFileUrl } from "@functions/api/v1/artifacts/file-queries";
import { sanitizeContentDispositionFilename } from "@functions/lib/artifact-evaluator";
import { jsonError, jsonResponse } from "@functions/lib/http";
import {
  adminOverview,
  adminReviewDetail,
  assertActiveReviewer,
  assertAssignmentScope,
  assignmentPolicy,
  assignmentSchema,
  assignReview,
  completionHash,
  completionSchema,
  idempotencyKeySchema,
  normalizeCompletion,
  REVIEW_AUTH_BATCH_SIZE,
  REVIEW_BODY_LIMIT_BYTES,
  REVIEW_PAGE_SIZE,
  REVIEW_RATE_LIMIT,
  REVIEW_STATS_LIMIT,
  REVIEW_VIEWS,
  ReviewError,
  reassignmentSchema,
  requireAssignment,
  reviewRpc,
  startSchema,
} from "@functions/lib/human-review";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { XP_AMOUNTS } from "@functions/lib/xp-engine.core";
import {
  checkDistributedRateLimit,
  getAuthUser,
  rateLimitErrorResponse,
} from "@functions/middleware";
import { apiLogger } from "@functions/shared/logger";
import { z } from "zod";
import { getReviewDetail } from "./queries";

/** Only request input failures are client errors; service schema failures remain 503s. */
function parseRequest<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ReviewError(
      result.error.issues[0]?.message ?? "Invalid request",
      400,
      "VALIDATION_ERROR",
    );
  return result.data;
}

async function readCommand(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ReviewError("JSON body required", 400, "INVALID_BODY");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > REVIEW_BODY_LIMIT_BYTES) {
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
    const rate = await checkDistributedRateLimit(
      context.env.RATE_LIMIT_KV,
      user.sub,
      REVIEW_RATE_LIMIT,
    );
    if (!rate.allowed)
      return rateLimitErrorResponse(
        requestId,
        rate.retryAfterMs,
        "Too many review requests. Please wait before retrying.",
      );
    const qb = createServiceQueryGateway(context.env);
    const url = new URL(context.request.url);
    const parts = url.pathname
      .replace(/^\/api\/v1\/reviews\/?/, "")
      .split("/")
      .filter(Boolean);
    const method = context.request.method;
    if (parts.length === 1 && (parts[0] === "queue" || parts[0] === "stats") && method === "GET") {
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
      await assertActiveReviewer(context.env, user.sub);
      const raw = z.array(assignmentSchema).parse(
        parts[0] === "stats"
          ? await qb.read(assignmentPolicy, {
              filters: [
                { column: "reviewer_id", op: "eq", value: user.sub },
                { column: "status", op: "in", value: ["pending", "in_progress"] },
              ],
              pageSize: REVIEW_STATS_LIMIT,
            })
          : await reviewRpc(qb, "list_artifact_review_queue", {
              p_actor_id: user.sub,
              p_after_due: after?.due ?? null,
              p_after_id: after?.id ?? null,
              p_limit: REVIEW_PAGE_SIZE + 1,
            }),
      );
      const pageRows = parts[0] === "stats" ? raw : raw.slice(0, REVIEW_PAGE_SIZE);
      const items = [];
      for (let offset = 0; offset < pageRows.length; offset += REVIEW_AUTH_BATCH_SIZE) {
        const authorized = await Promise.all(
          pageRows.slice(offset, offset + REVIEW_AUTH_BATCH_SIZE).map(async (row) => {
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
          truncated: raw.length === REVIEW_STATS_LIMIT,
        });
      const last = pageRows.at(-1);
      const nextCursor =
        raw.length > REVIEW_PAGE_SIZE && last
          ? btoa(JSON.stringify({ due: last.due_by, id: last.id }))
          : null;
      return jsonResponse({ success: true, items, nextCursor, hasMore: nextCursor !== null });
    }
    if (parts[0] === "operations") {
      if (parts.length === 2 && parts[1] === "overview" && method === "GET") {
        const query = parseRequest(
          z.object({
            view: z.enum(REVIEW_VIEWS).default("all"),
            q: z.string().trim().max(100).default(""),
            page: z.coerce.number().int().min(1).max(1000).default(1),
          }),
          {
            view: url.searchParams.get("view") ?? undefined,
            q: url.searchParams.get("q") ?? undefined,
            page: url.searchParams.get("page") ?? undefined,
          },
        );
        return jsonResponse(await adminOverview(qb, context.env, user.sub, query));
      }
      const reviewId = parseRequest(z.uuid(), parts[1]);
      if (parts.length === 2 && method === "GET")
        return jsonResponse(await adminReviewDetail(qb, context.env, user.sub, reviewId));
      if (parts.length === 3 && parts[2] === "reassign" && method === "POST")
        return jsonResponse({
          review: await assignReview(
            qb,
            context.env,
            user.sub,
            reviewId,
            parseRequest(reassignmentSchema, await readCommand(context.request)),
          ),
        });
      return jsonError("Not found", 404, { code: "NOT_FOUND", requestId });
    }
    const id = parseRequest(z.uuid(), parts[0]);
    const fileId =
      parts.length === 4 && parts[1] === "files" && parts[3] === "download" && method === "GET"
        ? parseRequest(z.uuid(), parts[2])
        : undefined;
    const command: z.infer<typeof startSchema> | z.infer<typeof completionSchema> | undefined =
      parts.length === 2 &&
      method === "POST" &&
      ["start", "complete", "return"].includes(parts[1] ?? "")
        ? parts[1] === "start"
          ? parseRequest(startSchema, await readCommand(context.request))
          : parseRequest(completionSchema, await readCommand(context.request))
        : undefined;
    const key =
      command && parts[1] !== "start"
        ? parseRequest(idempotencyKeySchema, context.request.headers.get("Idempotency-Key"))
        : undefined;
    if (
      parts[1] === "return" &&
      command &&
      "decision" in command &&
      command.decision !== "revise_and_resubmit"
    )
      throw new ReviewError("Return requires revision", 400, "INVALID_DECISION");
    const review = await requireAssignment(qb, context.env, id, user.sub);
    if (parts.length === 1 && method === "GET")
      return jsonResponse({ success: true, ...(await getReviewDetail(qb, review)) });
    if (parts.length === 4 && parts[1] === "files" && parts[3] === "download" && method === "GET") {
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
    if (command) {
      if (parts[1] === "start") {
        return jsonResponse({
          success: true,
          review: await reviewRpc(qb, "start_artifact_review", {
            p_review_id: id,
            p_actor_id: user.sub,
            p_version: command.expectedVersion,
          }),
        });
      }
      if ((parts[1] === "complete" || parts[1] === "return") && "decision" in command) {
        const result = await reviewRpc(qb, "complete_artifact_review", {
          p_review_id: id,
          p_actor_id: user.sub,
          p_key: key,
          p_hash: await completionHash(completionSchema.parse(command)),
          p_command: {
            ...normalizeCompletion(completionSchema.parse(command)),
            xpRewards: XP_AMOUNTS,
          },
        });
        return jsonResponse({ success: true, ...(result as Record<string, unknown>) });
      }
    }
    return jsonError("Not found", 404, { code: "NOT_FOUND", requestId });
  } catch (error) {
    if (error instanceof ReviewError)
      return jsonError(error.message, error.status, { code: error.code, requestId });
    apiLogger.error("Review request failed", error, { requestId });
    return jsonError("Review service unavailable", 503, { code: "REVIEW_UNAVAILABLE", requestId });
  }
}
