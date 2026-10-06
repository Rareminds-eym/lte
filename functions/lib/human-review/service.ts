import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { z } from "zod";
import { REVIEW_QUERY_LIMIT } from "./config";
import {
  type ReviewPolicy,
  type ReviewScope,
  reviewPolicySchema,
  reviewScopeSchema,
} from "./contracts";

export class ReviewError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}
export const assignmentSchema = z.object({
  id: z.uuid(),
  submission_id: z.uuid(),
  learner_id: z.uuid(),
  reviewer_id: z.uuid().nullable(),
  scope_id: z.uuid().nullable(),
  scope_type: z.enum(["college_program", "school_class"]).nullable(),
  status: z.enum(["unassigned", "pending", "in_progress", "completed", "returned"]),
  version: z.number().int(),
  rubric_snapshot: z.object({
    version: z.number(),
    criteria: z.array(z.object({ id: z.string(), label: z.string(), maxScore: z.number() })),
  }),
  required_at: z.string(),
  due_by: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});
export type ReviewAssignment = z.infer<typeof assignmentSchema>;
export const assignmentPolicy = {
  table: "review_assignments",
  operation: "read",
  columns: [
    "id",
    "submission_id",
    "learner_id",
    "reviewer_id",
    "scope_id",
    "scope_type",
    "status",
    "version",
    "rubric_snapshot",
    "required_at",
    "due_by",
    "started_at",
    "completed_at",
  ],
  filters: ["id", "reviewer_id", "submission_id", "learner_id", "status"],
  sorts: ["due_by", "id", "required_at"],
  maxPageSize: REVIEW_QUERY_LIMIT,
} as const;

export async function reviewRpc(qb: QueryGateway, name: string, args: Record<string, unknown>) {
  try {
    return await qb.rpc(
      { operation: "rpc", functionName: name, allowedArgs: Object.keys(args) },
      { args },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const cause =
      error && typeof error === "object" && "cause" in error
        ? String((error.cause as { message?: string })?.message ?? "")
        : "";
    const detail = `${message} ${cause}`;
    if (/REVIEW_NOT_FOUND/.test(detail))
      throw new ReviewError("Review not found", 404, "REVIEW_NOT_FOUND");
    if (/REVIEW_CONFLICT|IDEMPOTENCY_CONFLICT|REVIEW_PENDING/.test(detail))
      throw new ReviewError(
        "This review changed. Refresh before continuing.",
        409,
        "REVIEW_CONFLICT",
      );
    if (/INVALID_REVIEW|REVISION_ACTION_REQUIRED/.test(detail))
      throw new ReviewError("Invalid review command", 400, "INVALID_REVIEW_COMMAND");
    throw error;
  }
}

export async function getReviewScope(env: LteEnv, learnerId: string): Promise<ReviewScope | null> {
  const value = await callSkill(env, "review:scope", {}, learnerId);
  return value === null ? null : reviewScopeSchema.parse(value);
}

/** Organisation-wide AI/human choice for this learner (school or college). */
export async function getReviewPolicy(env: LteEnv, learnerId: string): Promise<ReviewPolicy> {
  return reviewPolicySchema.parse(await callSkill(env, "review:policy", {}, learnerId));
}

export async function assertActiveReviewer(env: LteEnv, id: string, organizationId?: string) {
  const authority = env.SSO_SERVICE;
  const [user, memberships] = await Promise.all([
    authority.getUserById(id),
    authority.getUserMemberships(id),
  ]);
  if (
    !user ||
    user.is_blocked ||
    !user.is_email_verified ||
    !memberships.memberships.some(
      (row) => row.status === "active" && (!organizationId || row.org_id === organizationId),
    )
  ) {
    throw new ReviewError("Reviewer access is no longer active", 403, "REVIEWER_INACTIVE");
  }
  return user;
}

export async function requireAssignment(
  qb: QueryGateway,
  env: LteEnv,
  reviewId: string,
  actorId: string,
) {
  const row = await qb.read(assignmentPolicy, {
    filters: [
      { column: "id", op: "eq", value: reviewId },
      { column: "reviewer_id", op: "eq", value: actorId },
    ],
    result: "maybeSingle",
  });
  if (!row) throw new ReviewError("Review not found", 404, "REVIEW_NOT_FOUND");
  const assignment = assignmentSchema.parse(row);
  await assertAssignmentScope(env, assignment, actorId);
  return assignment;
}

const reviewerCheckSchema = z
  .object({
    organizationId: z.uuid(),
    scopeId: z.uuid().nullable(),
    scopeType: z.enum(["college_program", "school_class"]).nullable(),
  })
  .nullable();

/**
 * A reviewer keeps access only while they are an active educator of the
 * learner's own organisation (an administrator may assign anyone there, with or
 * without a class/program), still hold an active membership in it, and, when the
 * review is tied to a class/program, the learner has not moved to another one.
 */
export async function assertAssignmentScope(
  env: LteEnv,
  assignment: ReviewAssignment,
  actorId: string,
) {
  const check = reviewerCheckSchema.parse(
    await callSkill(env, "review:reviewer-check", { reviewerId: actorId }, assignment.learner_id),
  );
  if (
    !check ||
    (assignment.scope_id !== null &&
      (check.scopeId !== assignment.scope_id || check.scopeType !== assignment.scope_type))
  ) {
    throw new ReviewError("Review not found", 404, "REVIEW_NOT_FOUND");
  }
  await assertActiveReviewer(env, actorId, check.organizationId);
}

export async function ensureAndAssignReview(
  qb: QueryGateway,
  env: LteEnv,
  submissionId: string,
  learnerId: string,
  reason: string,
) {
  const row = await reviewRpc(qb, "ensure_artifact_review", {
    p_submission_id: submissionId,
    p_learner_id: learnerId,
    p_reason: reason,
  });
  let assignment = assignmentSchema.parse(row);
  if (["completed", "returned"].includes(assignment.status)) return assignment;
  const scope = await getReviewScope(env, learnerId);
  if (!scope) return assignment;
  if (assignment.scope_id !== scope.scopeId || assignment.scope_type !== scope.scopeType) {
    assignment = assignmentSchema.parse(
      await reviewRpc(qb, "reconcile_artifact_review_scope", {
        p_review_id: assignment.id,
        p_learner_id: learnerId,
        p_version: assignment.version,
        p_scope_id: scope.scopeId,
        p_scope_type: scope.scopeType,
      }),
    );
  }
  if (assignment.status !== "unassigned") return assignment;
  if (!scope.reviewerIds.length) {
    return assignmentSchema.parse(
      await reviewRpc(qb, "assign_artifact_review", {
        p_review_id: assignment.id,
        p_scope_id: scope.scopeId,
        p_scope_type: scope.scopeType,
        p_candidates: [],
        p_sla_days: scope.slaDays,
        p_timezone: scope.timeZone,
        p_load_cap: scope.loadCap,
      }),
    );
  }
  const local = (await qb.read(
    {
      table: "users",
      operation: "read",
      columns: ["id", "status"],
      filters: ["id"],
      maxPageSize: REVIEW_QUERY_LIMIT,
    },
    {
      filters: [{ column: "id", op: "in", value: scope.reviewerIds }],
    },
  )) as Array<{ id: string; status: string }>;
  const candidates: string[] = [];
  for (const id of scope.reviewerIds) {
    const existing = local.find((row) => row.id === id);
    if (existing && existing.status !== "active") continue;
    try {
      const identity = await assertActiveReviewer(env, id, scope.organizationId);
      if (!existing) {
        // The mirror is populated only from the SSO authority, never request data.
        await qb.upsert(
          { table: "users", operation: "upsert", upsertColumns: ["id", "email"], onConflict: "id" },
          { id, email: identity.email },
        );
      }
      candidates.push(id);
    } catch (error) {
      if (!(error instanceof ReviewError)) throw error;
    }
  }
  return assignmentSchema.parse(
    await reviewRpc(qb, "assign_artifact_review", {
      p_review_id: assignment.id,
      p_scope_id: scope.scopeId,
      p_scope_type: scope.scopeType,
      p_candidates: candidates,
      p_sla_days: scope.slaDays,
      p_timezone: scope.timeZone,
      p_load_cap: scope.loadCap,
    }),
  );
}

export async function requiresFollowupReview(
  qb: QueryGateway,
  submissionId: string,
): Promise<boolean> {
  const current = (await qb.read(
    {
      table: "artifact_submissions",
      operation: "read",
      columns: ["previous_submission_id"],
      filters: ["id"],
    },
    {
      filters: [{ column: "id", op: "eq", value: submissionId }],
      result: "single",
    },
  )) as { previous_submission_id: string | null };
  if (!current.previous_submission_id) return false;
  const previous = await qb.read(assignmentPolicy, {
    filters: [
      { column: "submission_id", op: "eq", value: current.previous_submission_id },
      { column: "status", op: "eq", value: "returned" },
    ],
    result: "maybeSingle",
  });
  return previous !== null;
}
