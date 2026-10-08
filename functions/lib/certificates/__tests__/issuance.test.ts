import { QueryGatewayDatabaseError } from "@functions/lib/query-gateway";
import { awardXp } from "@functions/lib/xp-engine.core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { finalizePendingNames, issueCourseCertificate, issueRoleCertificate } from "../issuance";
import { gateway, levelId, pathId, row, userId } from "./fixtures";

vi.mock("@functions/lib/xp-engine.core", () => ({
  awardXp: vi.fn().mockResolvedValue({ success: true }),
}));
const input = { userId, levelId, learningPathId: pathId, levelProgressId: row.level_progress_id! };
function setup(existing: unknown = null, name: string | null = "Ada") {
  const mock = gateway();
  mock.read.mockImplementation(async (policy) => {
    switch (policy.table) {
      case "certificates":
        return existing;
      case "users":
        return { first_name: name, last_name: null };
      case "user_capability_level_progress":
        return {
          id: row.level_progress_id,
          level_id: levelId,
          learning_path_id: pathId,
          status: "completed",
          completed_at: row.completion_date,
          badge: "none",
        };
      case "levels":
        return {
          title: row.title,
          level_code: "L1",
          duration_minutes: 60,
          capabilities: { code: "PRO", name: "Problem solving" },
          level_scale: { level_no: 1 },
        };
      case "modules":
        return [{ id: "module" }];
      default:
        return null;
    }
  });
  mock.insert.mockImplementation(async (_policy, data) => ({ ...row, ...data }));
  return mock;
}
beforeEach(() => vi.clearAllMocks());
describe("certificate issuance", () => {
  it("snapshots completion and awards XP", async () => {
    const { qb, insert } = setup();
    const issued = await issueCourseCertificate(qb, {}, input);
    expect(issued.created).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        learner_name: "Ada",
        badge: null,
        completion_date: row.completion_date,
        metadata: expect.objectContaining({ moduleCount: 1, durationMinutes: 60 }),
      }),
      expect.objectContaining({ auth: { userId } }),
    );
    expect(awardXp).toHaveBeenCalledWith(
      qb,
      userId,
      "certificate_earned",
      "certificates",
      row.id,
      expect.anything(),
    );
  });
  it("returns an existing certificate and heals its XP", async () => {
    const { qb, insert } = setup(row);
    expect(await issueCourseCertificate(qb, {}, input)).toMatchObject({
      created: false,
      credentialId: row.credential_id,
    });
    expect(insert).not.toHaveBeenCalled();
    expect(awardXp).toHaveBeenCalledOnce();
  });
  it("does not award XP to a revoked existing certificate", async () => {
    const { qb } = setup({ ...row, status: "revoked" });
    expect((await issueCourseCertificate(qb, {}, input)).status).toBe("revoked");
    expect(awardXp).not.toHaveBeenCalled();
  });
  it("returns the concurrent natural-key winner", async () => {
    const { qb, read, insert } = setup();
    insert.mockRejectedValueOnce(new QueryGatewayDatabaseError("duplicate", { code: "23505" }));
    let calls = 0;
    const original = read.getMockImplementation()!;
    read.mockImplementation(async (policy, options) =>
      policy.table === "certificates" ? (++calls === 1 ? null : row) : original(policy, options),
    );
    expect((await issueCourseCertificate(qb, {}, input)).created).toBe(false);
  });
  it("retries credential collisions with a fresh ID", async () => {
    const { qb, insert } = setup();
    insert.mockRejectedValueOnce(
      new QueryGatewayDatabaseError("duplicate credential", { code: "23505" }),
    );
    expect((await issueCourseCertificate(qb, {}, input)).created).toBe(true);
    expect(insert.mock.calls[0]?.[1].credential_id).not.toBe(
      insert.mock.calls[1]?.[1].credential_id,
    );
  });
  it("bounds collision retries to three", async () => {
    const { qb, insert } = setup();
    insert.mockRejectedValue(new QueryGatewayDatabaseError("collision", { code: "23505" }));
    await expect(issueCourseCertificate(qb, {}, input)).rejects.toThrow("collision");
    expect(insert).toHaveBeenCalledTimes(3);
  });
  it("records missing names without XP", async () => {
    const { qb } = setup(null, null);
    expect((await issueCourseCertificate(qb, {}, input)).status).toBe("pending_name");
    expect(awardXp).not.toHaveBeenCalled();
  });
  it("rejects non-completed or mismatched progress", async () => {
    const { qb, read } = setup();
    const original = read.getMockImplementation()!;
    read.mockImplementation(async (policy, options) =>
      policy.table === "user_capability_level_progress"
        ? { status: "in_progress" }
        : original(policy, options),
    );
    await expect(issueCourseCertificate(qb, {}, input)).rejects.toThrow("not completed");
  });
  it("logs and propagates immutability violations without PII", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { qb, insert } = setup();
    insert.mockRejectedValue(
      new QueryGatewayDatabaseError("private learner name", { code: "23514" }),
    );
    await expect(issueCourseCertificate(qb, { requestId: "request" }, input)).rejects.toThrow();
    expect(log.mock.calls.flat().join(" ")).toContain("certificate.immutability_violation");
    expect(log.mock.calls.flat().join(" ")).not.toContain("private learner name");
    log.mockRestore();
  });
  it("finalizes names with a status compare-and-set and awards XP", async () => {
    const { qb, read, update } = gateway();
    read.mockImplementation(async (policy) =>
      policy.table === "users"
        ? { first_name: " Ada ", last_name: "Lovelace" }
        : [{ ...row, status: "pending_name" }],
    );
    update.mockResolvedValue([row]);
    expect(await finalizePendingNames(qb, {}, userId)).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        filters: expect.arrayContaining([{ column: "status", op: "eq", value: "pending_name" }]),
      }),
    );
    expect(awardXp).toHaveBeenCalledOnce();
    update.mockResolvedValue([]);
    expect(await finalizePendingNames(qb, {}, userId)).toBe(0);
  });
  it("leaves names pending when absent and propagates finalization failure", async () => {
    const { qb, read, update } = gateway();
    read.mockResolvedValue(null);
    expect(await finalizePendingNames(qb, {}, userId)).toBe(0);
    read.mockImplementation(async (policy) =>
      policy.table === "users" ? { first_name: "Ada" } : [row],
    );
    update.mockRejectedValue(new Error("unavailable"));
    await expect(finalizePendingNames(qb, {}, userId)).rejects.toThrow("unavailable");
  });
  it("issues role certificates at completed status regardless of readiness score", async () => {
    const { qb, read, insert } = setup();
    const original = read.getMockImplementation()!;
    read.mockImplementation(async (policy, options) => {
      if (policy.table === "learning_paths")
        return {
          id: pathId,
          role_id: levelId,
          learning_track_id: pathId,
          status: "completed",
          completed_at: row.completion_date,
          badge: "developing",
          role_readiness_percentage: 61,
        };
      if (policy.table === "roles") return { role_name: "Engineer" };
      if (policy.table === "learning_tracks") return { track: "Engineering" };
      if (policy.table === "user_capability_level_progress") return [{ level_id: levelId }];
      return original(policy, options);
    });
    await issueRoleCertificate(qb, {}, { userId, learningPathId: pathId });
    expect(insert.mock.calls[0]?.[1]).toMatchObject({
      certificate_type: "role_readiness",
      title: "Engineer",
      metadata: {
        readinessScore: 61,
        capabilities: [{ code: "PRO", name: "Problem solving", levelLabel: "Level 1" }],
      },
    });
  });
});
