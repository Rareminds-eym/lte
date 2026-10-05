import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_CRITERIA } from "../contracts";
import {
  assignmentSchema,
  ensureAndAssignReview,
  getReviewScope,
  type ReviewAssignment,
  ReviewError,
  requiresFollowupReview,
  reviewRpc,
} from "../service";

vi.mock("@functions/lib/skill-gateway", () => ({ callSkill: vi.fn() }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const makeAssignment = (overrides: Partial<ReviewAssignment> = {}): ReviewAssignment => ({
  id: id(1),
  submission_id: id(2),
  learner_id: id(3),
  reviewer_id: id(4),
  scope_id: id(5),
  scope_type: "school_class",
  status: "unassigned",
  version: 1,
  rubric_snapshot: { version: 1, criteria: [...REVIEW_CRITERIA] },
  required_at: new Date().toISOString(),
  due_by: null,
  started_at: null,
  completed_at: null,
  ...overrides,
});

const makeScope = (overrides = {}) => ({
  scopeId: id(5),
  scopeType: "school_class",
  organizationId: id(6),
  enabled: true,
  slaDays: 3,
  timeZone: "Asia/Kolkata",
  loadCap: 10,
  threshold: 60,
  reviewerIds: [id(4)],
  ...overrides,
});

const identity = vi.fn();
const memberships = vi.fn();
const env = {
  HUMAN_REVIEW_AVAILABLE: "true",
  HUMAN_REVIEW_ENABLED: "true",
  SSO_SERVICE: { getUserById: identity, getUserMemberships: memberships },
  LTE_SYNC_QUEUE: { send: vi.fn() },
} as unknown as LteEnv;

const rpc = vi.fn();
const read = vi.fn();
const upsert = vi.fn();
const qb = { rpc, read, upsert } as unknown as QueryGateway;

describe("service.ts", () => {
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

  describe("reviewRpc", () => {
    it("delegates to qb.rpc with correct policy shape", async () => {
      rpc.mockResolvedValue({ ok: true });
      const result = await reviewRpc(qb, "some_function", { p_id: id(1) });
      expect(result).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledWith(
        { operation: "rpc", functionName: "some_function", allowedArgs: ["p_id"] },
        { args: { p_id: id(1) } },
      );
    });

    it("maps REVIEW_NOT_FOUND errors to 404 ReviewError", async () => {
      rpc.mockRejectedValue(new Error("REVIEW_NOT_FOUND"));
      await expect(reviewRpc(qb, "fn", {})).rejects.toMatchObject({ status: 404 });
    });

    it("maps REVIEW_CONFLICT errors to 409 ReviewError", async () => {
      rpc.mockRejectedValue(new Error("REVIEW_CONFLICT"));
      await expect(reviewRpc(qb, "fn", {})).rejects.toMatchObject({ status: 409 });
    });

    it("maps IDEMPOTENCY_CONFLICT errors to 409 ReviewError", async () => {
      rpc.mockRejectedValue(new Error("IDEMPOTENCY_CONFLICT"));
      await expect(reviewRpc(qb, "fn", {})).rejects.toMatchObject({ status: 409 });
    });

    it("maps INVALID_REVIEW errors to 400 ReviewError", async () => {
      rpc.mockRejectedValue(new Error("INVALID_REVIEW"));
      await expect(reviewRpc(qb, "fn", {})).rejects.toMatchObject({ status: 400 });
    });

    it("re-throws unknown errors as-is", async () => {
      const err = new Error("database down");
      rpc.mockRejectedValue(err);
      await expect(reviewRpc(qb, "fn", {})).rejects.toBe(err);
    });
  });

  describe("getReviewScope", () => {
    it("returns null when authority returns null", async () => {
      vi.mocked(callSkill).mockResolvedValue(null);
      expect(await getReviewScope(env, id(3))).toBeNull();
    });

    it("validates and returns scope from authority", async () => {
      vi.mocked(callSkill).mockResolvedValue(makeScope());
      const scope = await getReviewScope(env, id(3));
      expect(scope?.scopeId).toBe(id(5));
    });
  });

  describe("ensureAndAssignReview", () => {
    it("returns completed assignments without scope lookup", async () => {
      const completed = makeAssignment({ status: "completed" });
      rpc.mockResolvedValue(completed);
      const result = await ensureAndAssignReview(qb, env, id(2), id(3), "test");
      expect(assignmentSchema.parse(result)).toBeTruthy();
      expect(callSkill).not.toHaveBeenCalled();
    });

    it("returns returned assignments without scope lookup", async () => {
      const returned = makeAssignment({ status: "returned" });
      rpc.mockResolvedValue(returned);
      const result = await ensureAndAssignReview(qb, env, id(2), id(3), "test");
      expect(result.status).toBe("returned");
      expect(callSkill).not.toHaveBeenCalled();
    });

    it("returns the assignment as-is when scope is null", async () => {
      rpc.mockResolvedValue(makeAssignment());
      vi.mocked(callSkill).mockResolvedValue(null);
      const result = await ensureAndAssignReview(qb, env, id(2), id(3), "test");
      expect(result.status).toBe("unassigned");
    });

    it("reconciles scope when assignment scope differs from authority", async () => {
      const assignment = makeAssignment({ scope_id: id(99), scope_type: "college_program" });
      const reconciled = makeAssignment({
        scope_id: id(5),
        scope_type: "school_class",
        status: "unassigned",
        version: 2,
      });
      rpc.mockResolvedValueOnce(assignment); // ensure_artifact_review
      vi.mocked(callSkill).mockResolvedValue(makeScope());
      rpc.mockResolvedValueOnce(reconciled); // reconcile_artifact_review_scope
      // assign_artifact_review
      const assigned = makeAssignment({ status: "pending", version: 3 });
      rpc.mockResolvedValueOnce(assigned);
      read.mockResolvedValue([{ id: id(4), status: "active" }]);

      const result = await ensureAndAssignReview(qb, env, id(2), id(3), "test");
      expect(rpc).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "reconcile_artifact_review_scope" }),
        expect.anything(),
      );
      expect(result.status).toBe("pending");
    });

    it("assigns with empty candidates when scope is disabled", async () => {
      const assignment = makeAssignment();
      rpc.mockResolvedValueOnce(assignment);
      vi.mocked(callSkill).mockResolvedValue(makeScope({ enabled: false }));
      rpc.mockResolvedValueOnce(makeAssignment({ status: "unassigned" }));

      await ensureAndAssignReview(qb, env, id(2), id(3), "test");
      expect(rpc).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "assign_artifact_review" }),
        expect.objectContaining({ args: expect.objectContaining({ p_candidates: [] }) }),
      );
    });

    it("filters inactive local users from candidates", async () => {
      const assignment = makeAssignment();
      rpc.mockResolvedValueOnce(assignment);
      vi.mocked(callSkill).mockResolvedValue(makeScope({ reviewerIds: [id(4), id(7)] }));
      read.mockResolvedValue([
        { id: id(4), status: "active" },
        { id: id(7), status: "inactive" },
      ]);
      rpc.mockResolvedValueOnce(makeAssignment({ status: "pending" }));

      await ensureAndAssignReview(qb, env, id(2), id(3), "test");
      const assignCall = rpc.mock.calls.find(
        ([policy]) => policy.functionName === "assign_artifact_review",
      );
      expect(assignCall?.[1].args.p_candidates).toEqual([id(4)]);
    });

    it("upserts unknown reviewers from SSO authority", async () => {
      const assignment = makeAssignment();
      rpc.mockResolvedValueOnce(assignment);
      vi.mocked(callSkill).mockResolvedValue(makeScope({ reviewerIds: [id(8)] }));
      read.mockResolvedValue([]); // no local user
      rpc.mockResolvedValueOnce(makeAssignment({ status: "pending" }));

      await ensureAndAssignReview(qb, env, id(2), id(3), "test");
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ table: "users" }), {
        id: id(8),
        email: "reviewer@example.test",
      });
    });
  });

  describe("requiresFollowupReview", () => {
    it("returns false when the submission has no previous_submission_id", async () => {
      read.mockResolvedValue({ previous_submission_id: null });
      expect(await requiresFollowupReview(qb, id(2))).toBe(false);
    });

    it("returns true when the previous submission was returned", async () => {
      read.mockResolvedValueOnce({ previous_submission_id: id(10) });
      read.mockResolvedValueOnce(makeAssignment({ status: "returned" }));
      expect(await requiresFollowupReview(qb, id(2))).toBe(true);
    });

    it("returns false when the previous submission has no returned review", async () => {
      read.mockResolvedValueOnce({ previous_submission_id: id(10) });
      read.mockResolvedValueOnce(null);
      expect(await requiresFollowupReview(qb, id(2))).toBe(false);
    });
  });

  describe("ReviewError", () => {
    it("carries status and code", () => {
      const error = new ReviewError("not found", 404, "REVIEW_NOT_FOUND");
      expect(error.message).toBe("not found");
      expect(error.status).toBe(404);
      expect(error.code).toBe("REVIEW_NOT_FOUND");
      expect(error).toBeInstanceOf(Error);
    });
  });
});
