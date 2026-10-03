import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_CRITERIA } from "../contracts";
import { dispatchReviewWork } from "../dispatch";
import { ensureAndAssignReview } from "../service";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn() }));
vi.mock("@functions/lib/skill-gateway", () => ({ callSkill: vi.fn() }));
vi.mock("@functions/lib/query-gateway", () => ({ createServiceQueryGateway: () => mock }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const assignment = {
  id: id(1),
  submission_id: id(2),
  learner_id: id(3),
  reviewer_id: id(4),
  scope_id: id(5),
  scope_type: "school_class",
  status: "in_progress",
  version: 3,
  rubric_snapshot: { version: 1, criteria: [...REVIEW_CRITERIA] },
  required_at: new Date().toISOString(),
  due_by: new Date().toISOString(),
  started_at: new Date().toISOString(),
  completed_at: null,
};
const scope = {
  scopeId: id(6),
  scopeType: "college_program",
  organizationId: id(7),
  enabled: false,
  slaDays: 3,
  timeZone: "Asia/Kolkata",
  loadCap: 10,
  threshold: 60,
  reviewerIds: [],
};
const recovered = {
  ...assignment,
  scope_id: scope.scopeId,
  scope_type: scope.scopeType,
  status: "unassigned",
  reviewer_id: null,
  due_by: null,
  started_at: null,
  version: 4,
};
const env = {
  HUMAN_REVIEW_AVAILABLE: "true",
  HUMAN_REVIEW_ENABLED: "false",
  LTE_SYNC_QUEUE: { send: vi.fn() },
} as unknown as LteEnv;
const qb = mock as unknown as QueryGateway;

describe("academic scope recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callSkill).mockResolvedValue(scope);
    mock.rpc.mockImplementation(async (policy: { functionName: string }) => {
      if (policy.functionName === "ensure_artifact_review") return assignment;
      if (
        policy.functionName === "reconcile_artifact_review_scope" ||
        policy.functionName === "assign_artifact_review"
      )
        return recovered;
      if (policy.functionName === "claim_review_scope_checks") return [assignment];
      return [];
    });
  });
  it("moves an existing review to the authoritative destination backlog even with assignment disabled", async () => {
    expect(await ensureAndAssignReview(qb, env, id(2), id(3), "scope_reconciliation")).toEqual(
      recovered,
    );
    expect(mock.rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "reconcile_artifact_review_scope" }),
      {
        args: {
          p_review_id: id(1),
          p_learner_id: id(3),
          p_version: 3,
          p_scope_id: id(6),
          p_scope_type: "college_program",
        },
      },
    );
    expect(mock.rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "assign_artifact_review" }),
      expect.objectContaining({ args: expect.objectContaining({ p_candidates: [] }) }),
    );
  });
  it("checks existing work during a pause without backfilling new assignments", async () => {
    await dispatchReviewWork(env);
    const functions = mock.rpc.mock.calls.map(([policy]) => policy.functionName);
    expect(functions).toContain("reconcile_artifact_review_scope");
    expect(functions).not.toContain("claim_review_reconciliation");
  });
  it("leaves a matching active scope and its reviewer unchanged", async () => {
    vi.mocked(callSkill).mockResolvedValue({ ...scope, scopeId: id(5), scopeType: "school_class" });
    expect(await ensureAndAssignReview(qb, env, id(2), id(3), "scope_reconciliation")).toEqual(
      assignment,
    );
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not move work when the academic authority is unavailable", async () => {
    vi.mocked(callSkill).mockRejectedValue(new Error("authority offline"));
    await expect(
      ensureAndAssignReview(qb, env, id(2), id(3), "scope_reconciliation"),
    ).rejects.toThrow("authority offline");
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
});
