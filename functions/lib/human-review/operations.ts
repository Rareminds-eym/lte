import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill, GatewayCallError } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { z } from "zod";
import { DEFAULT_REVIEW_SLA, REVIEW_PAGE_SIZE as PAGE_SIZE, REVIEW_QUERY_LIMIT } from "./config";
import { assertActiveReviewer, getReviewScope, ReviewError, reviewRpc } from "./service";

/**
 * Administrator operations. The administrator never reviews: they see every
 * review of their organisation and assign educators to them.
 *
 * Which learners and educators belong to the organisation is decided only by the
 * SkillPassport directory for the signed administrator (active college_admin /
 * school_admin memberships). Nothing here trusts an organisation, learner or
 * educator id taken from the request.
 */

export const REVIEW_VIEWS = [
  "all",
  "unassigned",
  "overdue",
  "active",
  "completed",
  "returned",
] as const;
export type ReviewView = (typeof REVIEW_VIEWS)[number];

const directorySchema = z.object({
  organizations: z.array(
    z.object({ id: z.uuid(), name: z.string(), orgType: z.enum(["school", "college"]) }),
  ),
  learners: z.array(
    z.object({
      userId: z.uuid(),
      name: z.string(),
      email: z.string().nullable(),
      organizationId: z.uuid(),
      scopeName: z.string().nullable(),
    }),
  ),
  educators: z.array(
    z.object({
      userId: z.uuid(),
      name: z.string(),
      email: z.string().nullable(),
      organizationId: z.uuid(),
    }),
  ),
  truncated: z.boolean(),
});
type Directory = z.infer<typeof directorySchema>;

const itemSchema = z.object({
  id: z.uuid(),
  submissionId: z.uuid(),
  learnerId: z.uuid(),
  reviewerId: z.uuid().nullable(),
  status: z.enum(["unassigned", "pending", "in_progress", "completed", "returned"]),
  version: z.number().int(),
  reason: z.string(),
  scopeId: z.uuid().nullable(),
  scopeType: z.enum(["college_program", "school_class"]).nullable(),
  requiredAt: z.string(),
  assignedAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  dueBy: z.string().nullable(),
  overdue: z.boolean(),
  attemptNo: z.number().int(),
  submittedAt: z.string().nullable(),
  artifactType: z.string().nullable(),
  moduleTitle: z.string().nullable(),
  levelTitle: z.string().nullable(),
  outcomeDecision: z.string().nullable(),
  outcomeScore: z.number().nullable(),
});
const pageSchema = z.object({ total: z.number().int(), items: z.array(itemSchema) });
const statsSchema = z.object({
  total: z.number().int(),
  unassigned: z.number().int(),
  overdue: z.number().int(),
  active: z.number().int(),
  completed: z.number().int(),
  returned: z.number().int(),
  oldestUnassignedAt: z.string().nullable(),
});

export async function adminDirectory(env: LteEnv, actorId: string): Promise<Directory> {
  try {
    const directory = directorySchema.parse(
      await callSkill(env, "review:org-directory", {}, actorId),
    );
    if (!directory.organizations.length)
      throw new ReviewError("No administrator access", 403, "FORBIDDEN");
    return directory;
  } catch (error) {
    if (error instanceof GatewayCallError && error.code === "FORBIDDEN")
      throw new ReviewError("No administrator access", 403, "FORBIDDEN");
    throw error;
  }
}

const matches = (text: string | null, needle: string) =>
  !!text && text.toLowerCase().includes(needle);

function present(
  item: z.infer<typeof itemSchema>,
  learners: Map<string, Directory["learners"][number]>,
  educators: Map<string, Directory["educators"][number]>,
) {
  const learner = learners.get(item.learnerId);
  const reviewer = item.reviewerId ? educators.get(item.reviewerId) : undefined;
  return {
    ...item,
    learner: {
      name: learner?.name ?? "Learner",
      email: learner?.email ?? null,
      organizationId: learner?.organizationId ?? null,
      scopeName: learner?.scopeName ?? null,
    },
    // A reviewer who is no longer an active educator of the organisation is shown
    // as such so the administrator knows to reassign.
    reviewer: item.reviewerId
      ? { id: item.reviewerId, name: reviewer?.name ?? "Former educator", active: !!reviewer }
      : null,
  };
}

export async function adminOverview(
  qb: QueryGateway,
  env: LteEnv,
  actorId: string,
  query: { view: ReviewView; q: string; page: number },
) {
  const directory = await adminDirectory(env, actorId);
  const learners = new Map(directory.learners.map((l) => [l.userId, l]));
  const educators = new Map(directory.educators.map((e) => [e.userId, e]));
  const needle = query.q.trim().toLowerCase();
  const scoped = needle
    ? directory.learners.filter((l) => matches(l.name, needle) || matches(l.email, needle))
    : directory.learners;
  const allIds = directory.learners.map((l) => l.userId);
  const [stats, page] = await Promise.all([
    reviewRpc(qb, "admin_review_stats", { p_learner_ids: allIds }).then((v) =>
      statsSchema.parse(v),
    ),
    scoped.length
      ? reviewRpc(qb, "admin_list_reviews", {
          p_learner_ids: scoped.map((l) => l.userId),
          p_view: query.view,
          p_limit: PAGE_SIZE,
          p_offset: (query.page - 1) * PAGE_SIZE,
        }).then((v) => pageSchema.parse(v))
      : Promise.resolve({ total: 0, items: [] as z.infer<typeof itemSchema>[] }),
  ]);
  return {
    organizations: directory.organizations,
    educatorCount: directory.educators.length,
    truncated: directory.truncated,
    stats,
    items: page.items.map((item) => present(item, learners, educators)),
    total: page.total,
    page: query.page,
    pageSize: PAGE_SIZE,
    hasMore: query.page * PAGE_SIZE < page.total,
  };
}

const auditSchema = z.array(
  z.object({
    action: z.string(),
    actor_id: z.uuid().nullable(),
    detail: z.record(z.string(), z.unknown()).nullable(),
    created_at: z.string(),
  }),
);

async function findReview(qb: QueryGateway, directory: Directory, reviewId: string) {
  const page = pageSchema.parse(
    await reviewRpc(qb, "admin_list_reviews", {
      p_learner_ids: directory.learners.map((l) => l.userId),
      p_view: "all",
      p_limit: 1,
      p_offset: 0,
      p_review_id: reviewId,
    }),
  );
  const item = page.items[0];
  if (!item) throw new ReviewError("Review not found", 404, "REVIEW_NOT_FOUND");
  return item;
}

export async function adminReviewDetail(
  qb: QueryGateway,
  env: LteEnv,
  actorId: string,
  reviewId: string,
) {
  const directory = await adminDirectory(env, actorId);
  const learners = new Map(directory.learners.map((l) => [l.userId, l]));
  const educators = new Map(directory.educators.map((e) => [e.userId, e]));
  const item = await findReview(qb, directory, reviewId);
  const learner = learners.get(item.learnerId);
  const audit = auditSchema.parse(
    await qb.read(
      {
        table: "review_audit",
        operation: "read",
        columns: ["action", "actor_id", "detail", "created_at"],
        filters: ["review_id"],
        sorts: ["created_at"],
        maxPageSize: REVIEW_QUERY_LIMIT,
      },
      {
        filters: [{ column: "review_id", op: "eq", value: reviewId }],
        sort: [{ column: "created_at", ascending: true }],
        pageSize: REVIEW_QUERY_LIMIT,
      },
    ),
  );
  const pool = directory.educators.filter(
    (e) => e.organizationId === learner?.organizationId && e.userId !== item.learnerId,
  );
  const load = z
    .record(z.string(), z.number())
    .parse(
      await reviewRpc(qb, "admin_reviewer_load", { p_reviewer_ids: pool.map((e) => e.userId) }),
    );
  return {
    review: present(item, learners, educators),
    timeline: audit.map((row) => ({
      action: row.action,
      at: row.created_at,
      actorName: row.actor_id
        ? row.actor_id === actorId
          ? "You"
          : (educators.get(row.actor_id)?.name ?? "Administrator")
        : null,
      reason: typeof row.detail?.["reason"] === "string" ? row.detail["reason"] : null,
      reviewerName:
        typeof row.detail?.["reviewerId"] === "string"
          ? (educators.get(row.detail["reviewerId"])?.name ?? "Former educator")
          : null,
    })),
    assignable: ["unassigned", "pending", "in_progress"].includes(item.status),
    candidates: pool
      .filter((e) => e.userId !== item.reviewerId)
      .map((e) => ({
        id: e.userId,
        name: e.name,
        email: e.email,
        openReviews: load[e.userId] ?? 0,
      }))
      .sort((a, b) => a.openReviews - b.openReviews || a.name.localeCompare(b.name)),
  };
}

export const reassignmentSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reviewerId: z.uuid(),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

/** Assign (or reassign) any active educator of the learner's organisation. */
export async function assignReview(
  qb: QueryGateway,
  env: LteEnv,
  actorId: string,
  reviewId: string,
  body: unknown,
) {
  const command = reassignmentSchema.parse(body);
  const directory = await adminDirectory(env, actorId);
  const item = await findReview(qb, directory, reviewId);
  if (!["unassigned", "pending", "in_progress"].includes(item.status))
    throw new ReviewError("This review is already finished", 409, "REVIEW_CONFLICT");
  const learner = directory.learners.find((l) => l.userId === item.learnerId);
  const educator = directory.educators.find(
    (e) => e.userId === command.reviewerId && e.organizationId === learner?.organizationId,
  );
  if (!learner || !educator || command.reviewerId === item.learnerId)
    throw new ReviewError(
      "Choose an active educator of your organization",
      400,
      "INVALID_REVIEW_COMMAND",
    );
  // Live identity check: the directory is a snapshot, SSO is the authority.
  const identity = await assertActiveReviewer(env, command.reviewerId, learner.organizationId);
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
  // SLA / capacity come from the learner's class or program when there is one.
  const scope = await getReviewScope(env, item.learnerId);
  if (scope && scope.organizationId !== learner.organizationId)
    throw new ReviewError(
      "Learner organization changed. Refresh before assigning.",
      409,
      "REVIEW_CONFLICT",
    );
  const settings = scope ?? DEFAULT_REVIEW_SLA;
  return reviewRpc(qb, "assign_review_in_scope", {
    p_review_id: reviewId,
    p_actor_id: actorId,
    p_reviewer_id: command.reviewerId,
    p_version: command.expectedVersion,
    p_reason: command.reason,
    p_expected_scope_id: item.scopeId,
    p_expected_scope_type: item.scopeType,
    p_scope_id: scope?.scopeId ?? null,
    p_scope_type: scope?.scopeType ?? null,
    p_load_cap: settings.loadCap,
    p_sla_days: settings.slaDays,
    p_timezone: settings.timeZone,
  });
}
