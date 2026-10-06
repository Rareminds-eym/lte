import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill, GatewayCallError } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminOverview, adminReviewDetail, assignReview } from "../operations";

vi.mock("@functions/lib/skill-gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@functions/lib/skill-gateway")>()),
  callSkill: vi.fn(),
}));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ORG = id(6);
const OTHER_ORG = id(60);
const LEARNER = id(3);
const LEARNER_NO_SCOPE = id(13);
const EDUCATOR = id(4);
const EDUCATOR_2 = id(7);
const ADMIN = id(100);

const directory = (overrides = {}) => ({
  organizations: [{ id: ORG, name: "Soundarya", orgType: "college" }],
  learners: [
    {
      userId: LEARNER,
      name: "Asha Rao",
      email: "asha@example.test",
      organizationId: ORG,
      scopeName: "BBA",
    },
    {
      userId: LEARNER_NO_SCOPE,
      name: "Bilal Khan",
      email: "bilal@example.test",
      organizationId: ORG,
      scopeName: null,
    },
  ],
  educators: [
    { userId: EDUCATOR, name: "Dr. Meera", email: "meera@example.test", organizationId: ORG },
    { userId: EDUCATOR_2, name: "Prof. Nikhil", email: "nikhil@example.test", organizationId: ORG },
    { userId: id(8), name: "Other College Prof", email: null, organizationId: OTHER_ORG },
  ],
  truncated: false,
  ...overrides,
});
const item = (overrides = {}) => ({
  id: id(1),
  submissionId: id(2),
  learnerId: LEARNER,
  reviewerId: EDUCATOR,
  status: "pending",
  version: 2,
  reason: "low_confidence",
  scopeId: id(5),
  scopeType: "college_program",
  requiredAt: "2026-10-01T00:00:00Z",
  assignedAt: "2026-10-01T01:00:00Z",
  startedAt: null,
  completedAt: null,
  dueBy: "2026-10-04T00:00:00Z",
  overdue: true,
  attemptNo: 1,
  submittedAt: "2026-10-01T00:00:00Z",
  artifactType: "final",
  moduleTitle: "Borrower intake",
  levelTitle: "Level 1",
  outcomeDecision: null,
  outcomeScore: null,
  ...overrides,
});
const stats = {
  total: 3,
  unassigned: 1,
  overdue: 1,
  active: 2,
  completed: 0,
  returned: 0,
  oldestUnassignedAt: null,
};

const identity = vi.fn();
const memberships = vi.fn();
const env = {
  SSO_SERVICE: { getUserById: identity, getUserMemberships: memberships },
} as unknown as LteEnv;
const rpc = vi.fn();
const read = vi.fn();
const upsert = vi.fn();
const qb = { rpc, read, upsert } as unknown as QueryGateway;
const rpcCalls = (name: string) =>
  rpc.mock.calls
    .filter(([policy]) => policy.functionName === name)
    .map(([, options]) => options.args);

function wire(dir = directory(), items = [item()]) {
  vi.mocked(callSkill).mockImplementation(async (_env, action) => {
    if (action === "review:org-directory") return dir;
    if (action === "review:scope") return null;
    return null;
  });
  rpc.mockImplementation(async (policy: { functionName: string }) => {
    if (policy.functionName === "admin_review_stats") return stats;
    if (policy.functionName === "admin_list_reviews") return { total: items.length, items };
    if (policy.functionName === "admin_reviewer_load") return { [EDUCATOR]: 2 };
    if (policy.functionName === "reassign_artifact_review")
      return { id: id(1), status: "pending", version: 3 };
    return null;
  });
}

describe("administrator operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identity.mockResolvedValue({
      email: "educator@example.test",
      is_blocked: false,
      is_email_verified: true,
    });
    memberships.mockResolvedValue({
      memberships: [{ status: "active", org_id: ORG, role: "educator" }],
    });
    read.mockResolvedValue(null);
    wire();
  });

  describe("organization directory", () => {
    it("is resolved for the signed administrator only", async () => {
      await adminOverview(qb, env, ADMIN, { view: "all", q: "", page: 1 });
      expect(callSkill).toHaveBeenCalledWith(env, "review:org-directory", {}, ADMIN);
    });
    it("maps a non-administrator to 403 instead of leaking the gateway error", async () => {
      vi.mocked(callSkill).mockRejectedValue(new GatewayCallError("no", "FORBIDDEN"));
      await expect(
        adminOverview(qb, env, ADMIN, { view: "all", q: "", page: 1 }),
      ).rejects.toMatchObject({ status: 403 });
    });
    it("treats an empty administrator directory as no access", async () => {
      wire(directory({ organizations: [], learners: [], educators: [] }));
      await expect(
        adminOverview(qb, env, ADMIN, { view: "all", q: "", page: 1 }),
      ).rejects.toMatchObject({ status: 403 });
    });
    it("surfaces a gateway outage as an error, never an empty list", async () => {
      vi.mocked(callSkill).mockRejectedValue(new GatewayCallError("down", "GATEWAY_UNREACHABLE"));
      await expect(adminOverview(qb, env, ADMIN, { view: "all", q: "", page: 1 })).rejects.toThrow(
        "down",
      );
    });
  });

  describe("adminOverview", () => {
    it("lists reviews with learner, class/program and educator names", async () => {
      const result = await adminOverview(qb, env, ADMIN, { view: "all", q: "", page: 1 });
      expect(result.stats).toEqual(stats);
      expect(result.items[0]).toMatchObject({
        learner: { name: "Asha Rao", scopeName: "BBA", organizationId: ORG },
        reviewer: { name: "Dr. Meera", active: true },
        overdue: true,
        moduleTitle: "Borrower intake",
      });
      expect(result).toMatchObject({
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
        educatorCount: 3,
      });
    });

    it("computes KPI stats over the whole organization, not the search result", async () => {
      await adminOverview(qb, env, ADMIN, { view: "all", q: "asha", page: 1 });
      expect(rpcCalls("admin_review_stats")[0]).toEqual({
        p_learner_ids: [LEARNER, LEARNER_NO_SCOPE],
      });
      expect(rpcCalls("admin_list_reviews")[0]).toMatchObject({ p_learner_ids: [LEARNER] });
    });

    it("only ever queries learners of the administrator's organization", async () => {
      await adminOverview(qb, env, ADMIN, { view: "all", q: "", page: 1 });
      const ids = rpcCalls("admin_list_reviews")[0].p_learner_ids as string[];
      expect(ids.sort()).toEqual([LEARNER, LEARNER_NO_SCOPE].sort());
    });

    it("searches by name or email, case-insensitively", async () => {
      await adminOverview(qb, env, ADMIN, { view: "all", q: "BILAL@", page: 1 });
      expect(rpcCalls("admin_list_reviews")[0]).toMatchObject({
        p_learner_ids: [LEARNER_NO_SCOPE],
      });
    });

    it("does not query the list at all when the search matches nobody", async () => {
      const result = await adminOverview(qb, env, ADMIN, { view: "all", q: "zzz", page: 1 });
      expect(rpcCalls("admin_list_reviews")).toHaveLength(0);
      expect(result).toMatchObject({ total: 0, items: [], hasMore: false });
    });

    it("passes view and 25-per-page offset, and reports more pages", async () => {
      wire(
        directory(),
        Array.from({ length: 25 }, (_, i) => item({ id: id(200 + i) })),
      );
      rpc.mockImplementation(async (policy: { functionName: string }) =>
        policy.functionName === "admin_review_stats"
          ? stats
          : { total: 60, items: Array.from({ length: 25 }, (_, i) => item({ id: id(200 + i) })) },
      );
      const result = await adminOverview(qb, env, ADMIN, { view: "overdue", q: "", page: 2 });
      expect(rpcCalls("admin_list_reviews")[0]).toMatchObject({
        p_view: "overdue",
        p_limit: 25,
        p_offset: 25,
      });
      expect(result.hasMore).toBe(true);
    });

    it("shows a reviewer who left the organization as a former educator", async () => {
      wire(directory(), [item({ reviewerId: id(99) })]);
      const result = await adminOverview(qb, env, ADMIN, { view: "all", q: "", page: 1 });
      expect(result.items[0]?.reviewer).toEqual({
        id: id(99),
        name: "Former educator",
        active: false,
      });
    });

    it("reports a truncated directory so the screen can warn", async () => {
      wire(directory({ truncated: true }));
      expect((await adminOverview(qb, env, ADMIN, { view: "all", q: "", page: 1 })).truncated).toBe(
        true,
      );
    });
  });

  describe("adminReviewDetail", () => {
    beforeEach(() => {
      read.mockResolvedValue([
        {
          action: "assigned",
          actor_id: null,
          detail: { reviewerId: EDUCATOR },
          created_at: "2026-10-01T01:00:00Z",
        },
        {
          action: "reassigned",
          actor_id: ADMIN,
          detail: { reviewerId: EDUCATOR_2, reason: "Workload" },
          created_at: "2026-10-02T00:00:00Z",
        },
      ]);
    });
    it("offers every other educator of the learner's organization, least loaded first", async () => {
      const detail = await adminReviewDetail(qb, env, ADMIN, id(1));
      expect(detail.candidates.map((c) => c.id)).toEqual([EDUCATOR_2]); // current reviewer excluded, other org excluded
      wire(directory(), [item({ reviewerId: null, status: "unassigned" })]);
      const open = await adminReviewDetail(qb, env, ADMIN, id(1));
      expect(open.candidates.map((c) => c.id)).toEqual([EDUCATOR_2, EDUCATOR]); // 0 open before 2 open
      expect(open.candidates[1]).toMatchObject({ id: EDUCATOR, openReviews: 2 });
    });
    it("never offers an educator of another organization or the learner themself", async () => {
      wire(
        directory({
          educators: [
            ...directory().educators,
            { userId: LEARNER, name: "Asha", email: null, organizationId: ORG },
          ],
        }),
      );
      const ids = (await adminReviewDetail(qb, env, ADMIN, id(1))).candidates.map((c) => c.id);
      expect(ids).not.toContain(LEARNER);
      expect(ids).not.toContain(id(8));
    });
    it("builds a readable timeline with who did what", async () => {
      const detail = await adminReviewDetail(qb, env, ADMIN, id(1));
      expect(detail.timeline).toEqual([
        {
          action: "assigned",
          at: "2026-10-01T01:00:00Z",
          actorName: null,
          reason: null,
          reviewerName: "Dr. Meera",
        },
        {
          action: "reassigned",
          at: "2026-10-02T00:00:00Z",
          actorName: "You",
          reason: "Workload",
          reviewerName: "Prof. Nikhil",
        },
      ]);
    });
    it("is assignable only while unresolved", async () => {
      expect((await adminReviewDetail(qb, env, ADMIN, id(1))).assignable).toBe(true);
      wire(directory(), [item({ status: "completed" })]);
      expect((await adminReviewDetail(qb, env, ADMIN, id(1))).assignable).toBe(false);
    });
    it("returns 404 for a review outside the organization", async () => {
      wire(directory(), []);
      await expect(adminReviewDetail(qb, env, ADMIN, id(1))).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("assignReview", () => {
    const body = { expectedVersion: 2, reviewerId: EDUCATOR_2, reason: "Cover for Dr. Meera" };
    it("assigns any active educator of the organization and records the reason", async () => {
      await assignReview(qb, env, ADMIN, id(1), body);
      expect(rpcCalls("reassign_artifact_review")[0]).toMatchObject({
        p_review_id: id(1),
        p_actor_id: ADMIN,
        p_reviewer_id: EDUCATOR_2,
        p_version: 2,
        p_reason: "Cover for Dr. Meera",
      });
    });
    it("verifies the educator against live SSO status for that organization", async () => {
      memberships.mockResolvedValue({
        memberships: [{ status: "active", org_id: id(99), role: "educator" }],
      });
      await expect(assignReview(qb, env, ADMIN, id(1), body)).rejects.toMatchObject({
        status: 403,
      });
      expect(rpcCalls("reassign_artifact_review")).toHaveLength(0);
    });
    it("works for a learner with no class or program, using default SLA settings", async () => {
      wire(directory(), [
        item({
          learnerId: LEARNER_NO_SCOPE,
          scopeId: null,
          scopeType: null,
          reviewerId: null,
          status: "unassigned",
        }),
      ]);
      await assignReview(qb, env, ADMIN, id(1), body);
      expect(rpcCalls("reassign_artifact_review")[0]).toMatchObject({
        p_scope_id: null,
        p_scope_type: null,
        p_sla_days: 3,
        p_timezone: "Asia/Kolkata",
        p_load_cap: 10,
      });
    });
    it("uses the class/program SLA and capacity when there is one", async () => {
      vi.mocked(callSkill).mockImplementation(async (_e, action) =>
        action === "review:org-directory"
          ? directory()
          : {
              scopeId: id(5),
              scopeType: "college_program",
              organizationId: ORG,
              slaDays: 5,
              timeZone: "Asia/Dubai",
              loadCap: 4,
              threshold: 60,
              reviewerIds: [],
            },
      );
      await assignReview(qb, env, ADMIN, id(1), body);
      expect(rpcCalls("reassign_artifact_review")[0]).toMatchObject({
        p_sla_days: 5,
        p_timezone: "Asia/Dubai",
        p_load_cap: 4,
      });
    });
    it("creates the local reviewer record from SSO identity, never from the request", async () => {
      await assignReview(qb, env, ADMIN, id(1), body);
      expect(upsert).toHaveBeenCalledWith(expect.anything(), {
        id: EDUCATOR_2,
        email: "educator@example.test",
      });
    });
    it.each([
      ["an educator of another organization", { ...body, reviewerId: id(8) }],
      ["someone who is not an educator", { ...body, reviewerId: id(55) }],
      ["the learner themself", { ...body, reviewerId: LEARNER }],
    ])("rejects %s", async (_n, bad) => {
      await expect(assignReview(qb, env, ADMIN, id(1), bad)).rejects.toMatchObject({ status: 400 });
      expect(rpcCalls("reassign_artifact_review")).toHaveLength(0);
    });
    it("rejects a review that is already finished", async () => {
      wire(directory(), [item({ status: "completed" })]);
      await expect(assignReview(qb, env, ADMIN, id(1), body)).rejects.toMatchObject({
        status: 409,
      });
    });
    it("rejects a review outside the administrator's organization", async () => {
      wire(directory(), []);
      await expect(assignReview(qb, env, ADMIN, id(1), body)).rejects.toMatchObject({
        status: 404,
      });
    });
    it("rejects an inactive local educator record", async () => {
      read.mockResolvedValue({ status: "inactive" });
      await expect(assignReview(qb, env, ADMIN, id(1), body)).rejects.toMatchObject({
        status: 400,
      });
    });
    it("validates the body strictly", async () => {
      await expect(assignReview(qb, env, ADMIN, id(1), { ...body, extra: true })).rejects.toThrow();
      await expect(
        assignReview(qb, env, ADMIN, id(1), { ...body, reason: "  " }),
      ).rejects.toThrow();
      await expect(
        assignReview(qb, env, ADMIN, id(1), { ...body, expectedVersion: 0 }),
      ).rejects.toThrow();
    });
  });
});
