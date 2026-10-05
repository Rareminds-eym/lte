import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_CRITERIA } from "../contracts";
import { dispatchReviewWork } from "../dispatch";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn() }));
vi.mock("@functions/lib/query-gateway", () => ({ createServiceQueryGateway: () => mock }));
vi.mock("@functions/lib/skill-gateway", () => ({ callSkill: vi.fn() }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const makeAssignment = (overrides = {}) => ({
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

const makeEnv = (overrides = {}) =>
  ({
    HUMAN_REVIEW_AVAILABLE: "true",
    HUMAN_REVIEW_ENABLED: "true",
    LTE_SYNC_QUEUE: { send: vi.fn() },
    SSO_SERVICE: {
      getUserById: vi.fn().mockResolvedValue({
        email: "r@test.io",
        is_blocked: false,
        is_email_verified: true,
      }),
      getUserMemberships: vi.fn().mockResolvedValue({
        memberships: [{ status: "active", org_id: id(6), role: "educator" }],
      }),
    },
    ...overrides,
  }) as unknown as LteEnv;

describe("dispatch.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callSkill).mockResolvedValue({
      scopeId: id(5),
      scopeType: "school_class",
      organizationId: id(6),
      enabled: true,
      slaDays: 3,
      timeZone: "Asia/Kolkata",
      loadCap: 10,
      threshold: 60,
      reviewerIds: [id(4)],
    });
  });

  it("skips all work when HUMAN_REVIEW_AVAILABLE is not true", async () => {
    await dispatchReviewWork(makeEnv({ HUMAN_REVIEW_AVAILABLE: "false" }));
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("runs scope reconciliation even when HUMAN_REVIEW_ENABLED is false", async () => {
    const assignment = makeAssignment();
    mock.rpc.mockImplementation(async (policy: { functionName: string }) => {
      if (policy.functionName === "claim_review_scope_checks") return [assignment];
      if (policy.functionName === "ensure_artifact_review") return assignment;
      if (policy.functionName === "assign_artifact_review") return assignment;
      if (policy.functionName === "schedule_review_deadlines") return null;
      if (policy.functionName === "claim_review_outbox") return [];
      return [];
    });
    mock.read.mockResolvedValue([{ id: id(4), status: "active" }]);

    await dispatchReviewWork(makeEnv({ HUMAN_REVIEW_ENABLED: "false" }));

    const functions = mock.rpc.mock.calls.map(([policy]) => policy.functionName);
    expect(functions).toContain("claim_review_scope_checks");
    expect(functions).not.toContain("claim_review_reconciliation");
  });

  it("runs full reconciliation when HUMAN_REVIEW_ENABLED is true", async () => {
    const assignment = makeAssignment();
    mock.rpc.mockImplementation(async (policy: { functionName: string }) => {
      if (policy.functionName === "claim_review_scope_checks") return [];
      if (policy.functionName === "claim_review_reconciliation") return [assignment];
      if (policy.functionName === "ensure_artifact_review") return assignment;
      if (policy.functionName === "assign_artifact_review") return assignment;
      if (policy.functionName === "schedule_review_deadlines") return null;
      if (policy.functionName === "claim_review_outbox") return [];
      return [];
    });
    mock.read.mockResolvedValue([{ id: id(4), status: "active" }]);

    await dispatchReviewWork(makeEnv());

    const functions = mock.rpc.mock.calls.map(([policy]) => policy.functionName);
    expect(functions).toContain("claim_review_reconciliation");
  });

  it("processes outbox events and sends to queue", async () => {
    const env = makeEnv();
    mock.rpc.mockImplementation(async (policy: { functionName: string }) => {
      if (policy.functionName === "claim_review_scope_checks") return [];
      if (policy.functionName === "claim_review_reconciliation") return [];
      if (policy.functionName === "schedule_review_deadlines") return null;
      if (policy.functionName === "claim_review_outbox")
        return [{ id: id(10), lease_token: id(11), event_type: "review.completed", payload: {} }];
      if (policy.functionName === "finish_review_outbox") return null;
      return [];
    });

    await dispatchReviewWork(env);

    expect(env.LTE_SYNC_QUEUE?.send).toHaveBeenCalledWith(
      { type: "review.completed", payload: {} },
      { contentType: "json" },
    );
    expect(mock.rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "finish_review_outbox" }),
      { args: { p_id: id(10), p_lease: id(11), p_success: true } },
    );
  });

  it("marks outbox event as failed when queue send fails", async () => {
    const env = makeEnv();
    const queue = env.LTE_SYNC_QUEUE;
    if (queue) {
      (queue.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("queue down"));
    }
    mock.rpc.mockImplementation(async (policy: { functionName: string }) => {
      if (policy.functionName === "claim_review_scope_checks") return [];
      if (policy.functionName === "claim_review_reconciliation") return [];
      if (policy.functionName === "schedule_review_deadlines") return null;
      if (policy.functionName === "claim_review_outbox")
        return [{ id: id(10), lease_token: id(11), event_type: "test", payload: {} }];
      if (policy.functionName === "finish_review_outbox") return null;
      return [];
    });

    await dispatchReviewWork(env);

    expect(mock.rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "finish_review_outbox" }),
      { args: { p_id: id(10), p_lease: id(11), p_success: false } },
    );
  });

  it("throws when LTE_SYNC_QUEUE is missing", async () => {
    mock.rpc.mockImplementation(async (policy: { functionName: string }) => {
      if (policy.functionName === "claim_review_scope_checks") return [];
      if (policy.functionName === "claim_review_reconciliation") return [];
      if (policy.functionName === "schedule_review_deadlines") return null;
      return [];
    });
    const env = makeEnv({ LTE_SYNC_QUEUE: undefined });
    await expect(dispatchReviewWork(env)).rejects.toThrow("LTE_SYNC_QUEUE");
  });

  it("continues processing other scope checks when one fails", async () => {
    const a1 = makeAssignment({ id: id(1), submission_id: id(2) });
    const a2 = makeAssignment({ id: id(10), submission_id: id(20) });
    let ensureCount = 0;
    mock.rpc.mockImplementation(async (policy: { functionName: string }) => {
      if (policy.functionName === "claim_review_scope_checks") return [a1, a2];
      if (policy.functionName === "ensure_artifact_review") {
        ensureCount++;
        if (ensureCount === 1) throw new Error("first fails");
        return a2;
      }
      if (policy.functionName === "assign_artifact_review") return a2;
      if (policy.functionName === "schedule_review_deadlines") return null;
      if (policy.functionName === "claim_review_outbox") return [];
      return [];
    });
    mock.read.mockResolvedValue([{ id: id(4), status: "active" }]);

    await dispatchReviewWork(makeEnv());
    // Both were attempted — second should succeed
    expect(ensureCount).toBe(2);
  });
});
