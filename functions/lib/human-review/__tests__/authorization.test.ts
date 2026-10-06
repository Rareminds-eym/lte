import type { QueryGateway } from "@functions/lib/query-gateway";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_CRITERIA } from "../contracts";
import { type ReviewAssignment, requireAssignment } from "../service";

vi.mock("@functions/lib/skill-gateway", () => ({ callSkill: vi.fn() }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const assignment: ReviewAssignment = {
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
};
const identity = vi.fn();
const memberships = vi.fn();
const env = {
  SSO_SERVICE: { getUserById: identity, getUserMemberships: memberships },
} as unknown as LteEnv;
// Answer of SkillPassport's review:reviewer-check for an eligible educator.
const check = () => ({ organizationId: id(6), scopeId: id(5), scopeType: "school_class" });
const read = vi.fn();
const qb = { read } as unknown as QueryGateway;

describe("live review authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    read.mockResolvedValue(assignment);
    vi.mocked(callSkill).mockResolvedValue(check());
    identity.mockResolvedValue({
      email: "reviewer@example.test",
      is_blocked: false,
      is_email_verified: true,
    });
    memberships.mockResolvedValue({
      memberships: [{ status: "active", org_id: id(6), role: "educator" }],
    });
  });
  it("permits existing required review after new assignments are disabled", async () => {
    expect(await requireAssignment(qb, env, id(1), id(4))).toEqual(assignment);
    expect(read).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        filters: [
          { column: "id", op: "eq", value: id(1) },
          { column: "reviewer_id", op: "eq", value: id(4) },
        ],
      }),
    );
  });
  it("returns not found for an unassigned actor without consulting learner scope", async () => {
    read.mockResolvedValue(null);
    await expect(requireAssignment(qb, env, id(1), id(9))).rejects.toMatchObject({ status: 404 });
    expect(callSkill).not.toHaveBeenCalled();
  });
  it("asks SkillPassport whether this educator may review this learner's work", async () => {
    await requireAssignment(qb, env, id(1), id(4));
    expect(callSkill).toHaveBeenCalledWith(
      env,
      "review:reviewer-check",
      { reviewerId: id(4) },
      id(3),
    );
  });
  it.each([
    ["not an active educator of the learner's organization", null],
    ["learner moved to another class", { ...check(), scopeId: id(99) }],
    ["learner moved to another kind of scope", { ...check(), scopeType: "college_program" }],
    ["learner no longer has a class or program", { ...check(), scopeId: null, scopeType: null }],
  ])("denies when the %s", async (_name, value) => {
    vi.mocked(callSkill).mockResolvedValue(value);
    await expect(requireAssignment(qb, env, id(1), id(4))).rejects.toMatchObject({ status: 404 });
  });
  it("lets an educator the administrator assigned to a learner with no class or program review it", async () => {
    read.mockResolvedValue({ ...assignment, scope_id: null, scope_type: null });
    vi.mocked(callSkill).mockResolvedValue({ ...check(), scopeId: null, scopeType: null });
    expect(await requireAssignment(qb, env, id(1), id(4))).toMatchObject({ scope_id: null });
  });
  it("does not need the educator to be in the class reviewer pool, only in the organization", async () => {
    // reviewer-check reports eligibility by organization; the pool is irrelevant to access.
    vi.mocked(callSkill).mockResolvedValue(check());
    await expect(requireAssignment(qb, env, id(1), id(4))).resolves.toBeDefined();
  });
  it("denies a blocked SSO account even while its local assignment exists", async () => {
    identity.mockResolvedValue({
      email: "reviewer@example.test",
      is_blocked: true,
      is_email_verified: true,
    });
    await expect(requireAssignment(qb, env, id(1), id(4))).rejects.toMatchObject({ status: 403 });
  });
  it("denies inactive memberships", async () => {
    memberships.mockResolvedValue({ memberships: [{ status: "suspended" }] });
    await expect(requireAssignment(qb, env, id(1), id(4))).rejects.toMatchObject({ status: 403 });
  });
  it("rejects an active membership in a different institution", async () => {
    memberships.mockResolvedValue({
      memberships: [{ status: "active", org_id: id(99), role: "educator" }],
    });
    await expect(requireAssignment(qb, env, id(1), id(4))).rejects.toMatchObject({ status: 403 });
  });
  it("does not substitute stale scope after an authority outage", async () => {
    vi.mocked(callSkill).mockRejectedValue(new Error("offline"));
    await expect(requireAssignment(qb, env, id(1), id(4))).rejects.toThrow("offline");
  });
});
