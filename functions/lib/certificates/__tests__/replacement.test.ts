import { QueryGatewayDatabaseError } from "@functions/lib/query-gateway";
import { describe, expect, it, vi } from "vitest";
import { replaceCertificate } from "../replacement";
import { gateway, row, userId } from "./fixtures";

const input = {
  certificateId: row.id,
  actorId: userId,
  reason: "Correct name",
  corrections: { learner_name: "Corrected Learner" },
};
describe("ops replacement", () => {
  it("uses the atomic RPC with a fresh credential and validated correction", async () => {
    const { qb } = gateway();
    vi.mocked(qb.rpc).mockResolvedValue({ ...row, supersedes_id: row.id });
    await replaceCertificate(qb, input);
    expect(qb.rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "replace_certificate" }),
      {
        args: expect.objectContaining({
          p_certificate_id: row.id,
          p_corrections: input.corrections,
          p_credential_id: expect.stringMatching(/^LTE-[0-9A-HJKMNP-TV-Z]{16}$/),
        }),
      },
    );
  });
  it("rejects identity corrections and empty names", async () => {
    const { qb } = gateway();
    await expect(
      replaceCertificate(qb, { ...input, corrections: { learner_name: " " } }),
    ).rejects.toThrow();
    await expect(
      replaceCertificate(qb, {
        ...input,
        corrections: { ...input.corrections, user_id: userId },
      } as typeof input),
    ).rejects.toThrow();
    expect(qb.rpc).not.toHaveBeenCalled();
  });
  it("retries credential collisions and propagates other errors", async () => {
    const { qb } = gateway();
    const error = new QueryGatewayDatabaseError("collision", { code: "23505" });
    vi.mocked(qb.rpc).mockRejectedValueOnce(error).mockResolvedValueOnce(row);
    await expect(replaceCertificate(qb, input)).resolves.toEqual(row);
    expect(qb.rpc).toHaveBeenCalledTimes(2);
    vi.mocked(qb.rpc).mockRejectedValue(new Error("database unavailable"));
    await expect(replaceCertificate(qb, input)).rejects.toThrow("database unavailable");
  });
});
