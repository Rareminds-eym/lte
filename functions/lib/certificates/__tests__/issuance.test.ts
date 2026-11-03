import { QueryGatewayDatabaseError } from "@functions/lib/query-gateway";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { finalizePendingNames, issueCourseCertificate, issueRoleCertificate } from "../issuance";
import { gateway, levelId, pathId, row, userId } from "./fixtures";

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
  mock.rpc.mockImplementation(async (_policy, options) => ({
    certificate: {
      ...row,
      status: options?.args?.p_status,
      learner_name: options?.args?.p_learner_name,
      issued_at: options?.args?.p_issued_at,
      certificate_type: options?.args?.p_certificate_type,
      title: options?.args?.p_title,
      role_id: options?.args?.p_role_id,
      level_id: options?.args?.p_level_id,
    },
    created: true,
  }));
  return mock;
}
beforeEach(() => vi.clearAllMocks());
describe("certificate issuance", () => {
  it("snapshots completion and awards XP", async () => {
    const { qb, rpc } = setup();
    const issued = await issueCourseCertificate(qb, {}, input);
    expect(issued.created).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "issue_certificate_atomic" }),
      expect.objectContaining({
        auth: { userId },
        args: expect.objectContaining({
          p_learner_name: "Ada",
          p_badge: null,
          p_completion_date: row.completion_date,
          p_metadata: expect.objectContaining({ moduleCount: 1, durationMinutes: 60 }),
          p_xp_amount: 50,
        }),
      }),
    );
  });
  it("returns an existing certificate without a write", async () => {
    const { qb, rpc } = setup(row);
    expect(await issueCourseCertificate(qb, {}, input)).toMatchObject({
      created: false,
      credentialId: row.credential_id,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not award XP to a revoked existing certificate", async () => {
    const { qb } = setup({ ...row, status: "revoked" });
    expect((await issueCourseCertificate(qb, {}, input)).status).toBe("revoked");
    expect(qb.rpc).not.toHaveBeenCalled();
  });
  it("returns the concurrent natural-key winner", async () => {
    const { qb, read, rpc } = setup();
    rpc.mockRejectedValueOnce(new QueryGatewayDatabaseError("duplicate", { code: "23505" }));
    let calls = 0;
    const original = read.getMockImplementation()!;
    read.mockImplementation(async (policy, options) =>
      policy.table === "certificates" ? (++calls === 1 ? null : row) : original(policy, options),
    );
    expect((await issueCourseCertificate(qb, {}, input)).created).toBe(false);
  });
  it("retries credential collisions with a fresh ID", async () => {
    const { qb, rpc } = setup();
    rpc.mockRejectedValueOnce(
      new QueryGatewayDatabaseError("duplicate credential", { code: "23505" }),
    );
    rpc.mockImplementationOnce(async (_policy, options) => ({
      certificate: { ...row, credential_id: options?.args?.p_credential_id },
      created: true,
    }));
    expect((await issueCourseCertificate(qb, {}, input)).created).toBe(true);
    expect(rpc.mock.calls[0]?.[1].args.p_credential_id).not.toBe(
      rpc.mock.calls[1]?.[1].args.p_credential_id,
    );
  });
  it("bounds collision retries to three", async () => {
    const { qb, rpc } = setup();
    rpc.mockRejectedValue(new QueryGatewayDatabaseError("collision", { code: "23505" }));
    await expect(issueCourseCertificate(qb, {}, input)).rejects.toThrow("collision");
    expect(rpc).toHaveBeenCalledTimes(3);
  });
  it("records missing names without XP", async () => {
    const { qb } = setup(null, null);
    expect((await issueCourseCertificate(qb, {}, input)).status).toBe("pending_name");
    expect(qb.rpc).toHaveBeenCalledOnce();
  });
  it("rejects non-completed or mismatched progress", async () => {
    const { qb, read } = setup();
    const original = read.getMockImplementation()!;
    read.mockImplementation(async (policy, options) =>
      policy.table === "user_capability_level_progress"
        ? { ...(await original(policy, options)), status: "in_progress" }
        : original(policy, options),
    );
    await expect(issueCourseCertificate(qb, {}, input)).rejects.toThrow("not completed");
  });
  it("logs and propagates immutability violations without PII", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { qb, rpc } = setup();
    rpc.mockRejectedValue(new QueryGatewayDatabaseError("private learner name", { code: "23514" }));
    await expect(issueCourseCertificate(qb, { requestId: "request" }, input)).rejects.toThrow();
    expect(log.mock.calls.flat().join(" ")).toContain("certificate.immutability_violation");
    expect(log.mock.calls.flat().join(" ")).not.toContain("private learner name");
    log.mockRestore();
  });
  it("finalizes names with a status compare-and-set and awards XP", async () => {
    const { qb, read, rpc } = gateway();
    read.mockImplementation(async (policy) =>
      policy.table === "users"
        ? { first_name: " Ada ", last_name: "Lovelace" }
        : [{ ...row, status: "pending_name" }],
    );
    rpc.mockResolvedValue(row);
    expect(await finalizePendingNames(qb, {}, userId)).toBe(1);
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "finalize_certificate_name_atomic" }),
      expect.objectContaining({
        auth: { userId },
        args: expect.objectContaining({ p_certificate_id: row.id, p_xp_amount: 50 }),
      }),
    );
    rpc.mockResolvedValue(null);
    expect(await finalizePendingNames(qb, {}, userId)).toBe(0);
  });
  it("leaves names pending when absent and propagates finalization failure", async () => {
    const { qb, read, rpc } = gateway();
    read.mockResolvedValue(null);
    expect(await finalizePendingNames(qb, {}, userId)).toBe(0);
    read.mockImplementation(async (policy) =>
      policy.table === "users" ? { first_name: "Ada" } : [row],
    );
    rpc.mockRejectedValue(new Error("unavailable"));
    await expect(finalizePendingNames(qb, {}, userId)).rejects.toThrow("unavailable");
  });
  it("issues role certificates at completed status regardless of readiness score", async () => {
    const { qb, read, rpc } = setup();
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
      if (policy.table === "user_capability_level_progress")
        return [
          {
            id: row.level_progress_id,
            level_id: levelId,
            learning_path_id: pathId,
            status: "completed",
            completed_at: row.completion_date,
            badge: null,
          },
        ];
      return original(policy, options);
    });
    await issueRoleCertificate(qb, {}, { userId, learningPathId: pathId });
    expect(rpc.mock.calls[0]?.[1].args).toMatchObject({
      p_certificate_type: "role_readiness",
      p_title: "Engineer",
      p_metadata: {
        readinessScore: 61,
        capabilities: [{ code: "PRO", name: "Problem solving", levelLabel: "Level 1" }],
      },
    });
  });
});
