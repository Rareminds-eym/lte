import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { z } from "zod";
import {
  assertActiveReviewer,
  assignmentPolicy,
  assignmentSchema,
  getReviewScope,
  ReviewError,
  reviewRpc,
} from "./service";

const scopeSchema = z.object({
  scopeId: z.uuid(),
  scopeType: z.enum(["school_class", "college_program"]),
  organizationId: z.uuid(),
  name: z.string(),
});
export async function adminScopes(env: LteEnv, actorId: string) {
  return z.array(scopeSchema).parse(await callSkill(env, "review:admin-scopes", {}, actorId));
}

export async function adminBacklog(
  qb: QueryGateway,
  env: LteEnv,
  actorId: string,
  scopeId: string,
  page: number,
) {
  const scopes = await adminScopes(env, actorId);
  const scope = scopes.find((s) => s.scopeId === scopeId);
  if (!scope) throw new ReviewError("Scope not found", 404, "REVIEW_NOT_FOUND");
  const items = z.array(assignmentSchema).parse(
    await qb.read(
      { ...assignmentPolicy, filters: [...assignmentPolicy.filters, "scope_id", "scope_type"] },
      {
        filters: [
          { column: "scope_id", op: "eq", value: scopeId },
          { column: "scope_type", op: "eq", value: scope.scopeType },
          { column: "status", op: "in", value: ["unassigned", "pending", "in_progress"] },
        ],
        sort: [
          { column: "required_at", ascending: true },
          { column: "id", ascending: true },
        ],
        page,
        pageSize: 25,
      },
    ),
  );
  const stats = await reviewRpc(qb, "review_operations_stats", {
    p_scope_id: scopeId,
    p_scope_type: scope.scopeType,
  });
  return { items, page, hasMore: items.length === 25, stats };
}

export async function adminReview(
  qb: QueryGateway,
  env: LteEnv,
  actorId: string,
  reviewId: string,
) {
  const raw = await qb.read(assignmentPolicy, {
    filters: [{ column: "id", op: "eq", value: reviewId }],
    result: "maybeSingle",
  });
  if (!raw) throw new ReviewError("Review not found", 404, "REVIEW_NOT_FOUND");
  const review = assignmentSchema.parse(raw);
  const scopes = await adminScopes(env, actorId);
  if (!scopes.some((s) => s.scopeId === review.scope_id && s.scopeType === review.scope_type))
    throw new ReviewError("Review not found", 404, "REVIEW_NOT_FOUND");
  const scope = await getReviewScope(env, review.learner_id);
  if (
    !scope ||
    scope.scopeId !== review.scope_id ||
    scope.scopeType !== review.scope_type ||
    !scopes.some((s) => s.organizationId === scope.organizationId && s.scopeId === scope.scopeId)
  ) {
    throw new ReviewError("The learner's review scope changed", 409, "REVIEW_CONFLICT");
  }
  return { review, scope };
}

export const reassignmentSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reviewerId: z.uuid(),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export async function reassignReview(
  qb: QueryGateway,
  env: LteEnv,
  actorId: string,
  reviewId: string,
  body: unknown,
) {
  const command = reassignmentSchema.parse(body);
  const { review, scope } = await adminReview(qb, env, actorId, reviewId);
  if (!scope.reviewerIds.includes(command.reviewerId) || command.reviewerId === review.learner_id)
    throw new ReviewError("Choose an eligible educator", 400, "INVALID_REVIEW_COMMAND");
  const identity = await assertActiveReviewer(env, command.reviewerId, scope.organizationId);
  const local = (await qb.read(
    { table: "users", operation: "read", columns: ["id", "status"], filters: ["id"] },
    { filters: [{ column: "id", op: "eq", value: command.reviewerId }], result: "maybeSingle" },
  )) as { status: string } | null;
  if (local && local.status !== "active")
    throw new ReviewError("Educator is inactive", 400, "INVALID_REVIEW_COMMAND");
  if (!local)
    await qb.upsert(
      { table: "users", operation: "upsert", upsertColumns: ["id", "email"], onConflict: "id" },
      { id: command.reviewerId, email: identity.email },
    );
  return reviewRpc(qb, "reassign_artifact_review", {
    p_review_id: reviewId,
    p_actor_id: actorId,
    p_reviewer_id: command.reviewerId,
    p_version: command.expectedVersion,
    p_reason: command.reason,
    p_scope_id: scope.scopeId,
    p_scope_type: scope.scopeType,
    p_load_cap: scope.loadCap,
    p_sla_days: scope.slaDays,
    p_timezone: scope.timeZone,
  });
}
