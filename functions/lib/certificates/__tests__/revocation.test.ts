import { expect, it } from "vitest";
import { revokeCertificate } from "../revocation";
import { gateway, row, userId } from "./fixtures";

it("validates the command and only revokes issued rows", async () => {
  const { qb, update } = gateway();
  await expect(
    revokeCertificate(qb, { certificateId: "bad", actorId: userId, reason: "Reason" }),
  ).rejects.toThrow();
  expect(update).not.toHaveBeenCalled();
  await revokeCertificate(qb, { certificateId: row.id, actorId: userId, reason: " Reason " });
  expect(update.mock.calls[0]?.[1]).toMatchObject({
    filters: [
      { column: "id", op: "eq", value: row.id },
      { column: "status", op: "eq", value: "issued" },
    ],
    data: { status: "revoked", revoked_reason: "Reason", revoked_by: userId },
  });
});
