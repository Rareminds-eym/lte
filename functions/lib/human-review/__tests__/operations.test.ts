import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_CRITERIA } from "../contracts";
import { adminBacklog, adminReview, adminScopes, reassignReview } from "../operations";

vi.mock("@functions/lib/skill-gateway", () => ({ callSkill: vi.fn() }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const makeAssignment = (overrides = {}) => ({
  id: id(1),
  submission_id: id(2),
  learner_id: id(3),
  reviewer_id: id(4),
  scope_id: id(5),
  scope_type: "school_class",
  status: "pending",
  version: 2,
  rubric_snapshot: { version: 1, criteria: [...REVIEW_CRITERIA] },
  required_at: new Date().toISOString(),
  due_by: new Date().toISOString(),
  started_at: null,
  completed_at: null,
  ...overrides,
});

const makeScope = (overrides = {}) => ({
  scopeId: id(5),
  scopeType: "school_class",
  organizationId: id(6),
  name: "Class A",
  ...overrides,
});

const makeReviewScope = (overrides = {}) => ({
  scopeId: id(5),
  scopeType: "school_class",
  organizationId: id(6),
  enabled: true,
  slaDays: 3,
  timeZone: "Asia/Kolkata",
  loadCap: 10,
  threshold: 60,
  reviewerIds: [id(4), id(7)],
  ...overrides,
});

const identity = vi.fn();
const memberships = vi.fn();
const env = {
  HUMAN_REVIEW_AVAILABLE: "true",
  HUMAN_REVIEW_ENABLED: "true",
  SSO_SERVICE: { getUserById: identity, getUserMemberships: memberships },
} as unknown as LteEnv;

const rpc = vi.fn();
const read = vi.fn();
const upsert = vi.fn();
const qb = { rpc, read, upsert } as unknown as QueryGateway;

describe("operations.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identity.mockResolvedValue({
      email: "reviewer@example.test",
      is_blocked: false,
      is_email_verified: true,
    });
    memberships.mockResolvedValue({
      memberships: [{ status: "active", org_id: id(6), role: "educator" }],
    });
  });

  describe("adminScopes", () => {
    it("returns validated scopes from the authority", async () => {
      vi.mocked(callSkill).mockResolvedValue([makeScope()]);
      const scopes = await adminScopes(env, id(4));
      expect(scopes).toHaveLength(1);
      const firstScope = scopes[0];
      if (firstScope) {
        expect(firstScope.scopeId).toBe(id(5));
      }
    });

    it("throws on invalid scope shape", async () => {
      vi.mocked(callSkill).mockResolvedValue([{ invalid: true }]);
      await expect(adminScopes(env, id(4))).rejects.toThrow();
    });
  });

  describe("adminBacklog", () => {
    it("returns items and stats for a valid scope", async () => {
      vi.mocked(callSkill).mockResolvedValue([makeScope()]);
      const items = [makeAssignment()];
      read.mockResolvedValue(items);
      rpc.mockResolvedValue({ pending: 1, in_progress: 0 });

      const result = await adminBacklog(qb, env, id(4), id(5), 1);
      expect(result.items).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.stats).toEqual({ pending: 1, in_progress: 0 });
    });

    it("throws 404 when actor does not have access to the scope", async () => {
      vi.mocked(callSkill).mockResolvedValue([makeScope({ scopeId: id(99) })]);
      await expect(adminBacklog(qb, env, id(4), id(5), 1)).rejects.toMatchObject({ status: 404 });
    });

    it("reports hasMore when page is full", async () => {
      vi.mocked(callSkill).mockResolvedValue([makeScope()]);
      const items = Array.from({ length: 25 }, (_, i) => makeAssignment({ id: id(100 + i) }));
      read.mockResolvedValue(items);
      rpc.mockResolvedValue({});

      const result = await adminBacklog(qb, env, id(4), id(5), 1);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("adminReview", () => {
    it("returns review and scope when actor has access", async () => {
      read.mockResolvedValue(makeAssignment());
      vi.mocked(callSkill).mockImplementation(async (_env, action) => {
        if (action === "review:admin-scopes") return [makeScope()];
        if (action === "review:scope") return makeReviewScope();
        return null;
      });

      const result = await adminReview(qb, env, id(4), id(1));
      expect(result.review.id).toBe(id(1));
      expect(result.scope.scopeId).toBe(id(5));
    });

    it("throws 404 when review does not exist", async () => {
      read.mockResolvedValue(null);
      await expect(adminReview(qb, env, id(4), id(1))).rejects.toMatchObject({ status: 404 });
    });

    it("throws 404 when actor lacks scope access", async () => {
      read.mockResolvedValue(makeAssignment());
      vi.mocked(callSkill).mockResolvedValue([makeScope({ scopeId: id(99) })]);
      await expect(adminReview(qb, env, id(4), id(1))).rejects.toMatchObject({ status: 404 });
    });

    it("throws 409 when learner scope changed", async () => {
      read.mockResolvedValue(makeAssignment());
      vi.mocked(callSkill).mockImplementation(async (_env, action) => {
        if (action === "review:admin-scopes") return [makeScope()];
        if (action === "review:scope")
          return makeReviewScope({ scopeId: id(88), scopeType: "college_program" });
        return null;
      });
      await expect(adminReview(qb, env, id(4), id(1))).rejects.toMatchObject({ status: 409 });
    });
  });

  describe("reassignReview", () => {
    it("rejects when new reviewer is the learner", async () => {
      read.mockResolvedValue(makeAssignment({ learner_id: id(7) }));
      vi.mocked(callSkill).mockImplementation(async (_env, action) => {
        if (action === "review:admin-scopes") return [makeScope()];
        if (action === "review:scope") return makeReviewScope();
        return null;
      });

      await expect(
        reassignReview(qb, env, id(4), id(1), {
          expectedVersion: 2,
          reviewerId: id(7), // same as learner_id
          reason: "test",
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("rejects when reviewer is not in the candidate list", async () => {
      read.mockResolvedValue(makeAssignment());
      vi.mocked(callSkill).mockImplementation(async (_env, action) => {
        if (action === "review:admin-scopes") return [makeScope()];
        if (action === "review:scope") return makeReviewScope({ reviewerIds: [id(4)] }); // id(99) not in list
        return null;
      });

      await expect(
        reassignReview(qb, env, id(4), id(1), {
          expectedVersion: 2,
          reviewerId: id(99),
          reason: "test",
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("validates body schema", async () => {
      await expect(reassignReview(qb, env, id(4), id(1), { bad: "shape" })).rejects.toThrow();
    });
  });
});
