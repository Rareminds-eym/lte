import { beforeEach, expect, it, vi } from "vitest";
import {
  awardCertificateXp,
  finalizePendingNames,
  issueCourseCertificate,
  issueRoleCertificate,
} from "../issuance";
import { certificateOwnerReadPolicy, readAll } from "../queries";
import { ensureCertificatesForUser } from "../reconcile";
import { revokeCertificate } from "../revocation";
import { gateway, row, userId } from "./fixtures";

vi.mock("../issuance", () => ({
  awardCertificateXp: vi.fn(),
  finalizePendingNames: vi.fn(),
  issueCourseCertificate: vi.fn(),
  issueRoleCertificate: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("backfills no more than five distinct natural subjects per call", async () => {
  const { qb, read } = gateway();
  read.mockImplementation(async (policy) =>
    policy.table === "certificates"
      ? [row]
      : policy.table === "learning_paths"
        ? [{ id: "path", role_id: "role" }]
        : [
            { level_id: row.level_id },
            ...Array.from({ length: 8 }, (_, index) => ({
              id: `progress-${index}`,
              level_id: `level-${index}`,
              learning_path_id: "path",
            })),
          ],
  );
  await ensureCertificatesForUser(qb, {}, userId);
  expect(issueCourseCertificate).toHaveBeenCalledTimes(5);
  expect(issueRoleCertificate).not.toHaveBeenCalled();
  expect(finalizePendingNames).toHaveBeenCalled();
  expect(awardCertificateXp).toHaveBeenCalledWith(qb, row);
});
it("backfills roles, deduplicates reimports, and tolerates individual failures", async () => {
  const { qb, read } = gateway();
  read.mockImplementation(async (policy) =>
    policy.table === "certificates"
      ? []
      : policy.table === "learning_paths"
        ? [
            { id: "path", role_id: "role" },
            { id: "path2", role_id: "role" },
          ]
        : [{ id: "progress", level_id: "level", learning_path_id: "path" }],
  );
  vi.mocked(issueCourseCertificate).mockRejectedValueOnce(new Error("temporary"));
  await ensureCertificatesForUser(qb, {}, userId);
  expect(issueRoleCertificate).toHaveBeenCalledOnce();
  expect(finalizePendingNames).toHaveBeenCalled();
});
it("explicitly pages reads past the server cap", async () => {
  const { qb, read } = gateway();
  read.mockResolvedValueOnce(Array.from({ length: 100 }, () => row)).mockResolvedValueOnce([row]);
  expect((await readAll(qb, certificateOwnerReadPolicy, { auth: { userId } })).length).toBe(101);
  expect(read.mock.calls[1]?.[1].page).toBe(2);
});
it("revokes only issued rows and validates the ops input", async () => {
  const { qb, update } = gateway();
  await revokeCertificate(qb, {
    certificateId: row.id,
    actorId: userId,
    reason: "Incorrect completion",
  });
  expect(update).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      data: expect.objectContaining({ status: "revoked", revoked_by: userId }),
      filters: expect.arrayContaining([{ column: "status", op: "eq", value: "issued" }]),
    }),
  );
  await expect(
    revokeCertificate(qb, { certificateId: "bad", actorId: userId, reason: "" }),
  ).rejects.toThrow();
  update.mockRejectedValue(new Error("database"));
  await expect(
    revokeCertificate(qb, { certificateId: row.id, actorId: userId, reason: "reason" }),
  ).rejects.toThrow("database");
});
