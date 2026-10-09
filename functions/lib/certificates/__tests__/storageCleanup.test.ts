import type { LteEnv } from "@functions/lib/types";
import { expect, it, vi } from "vitest";
import { drainCertificateStorageCleanup, registerCertificateUpload } from "../storageCleanup";
import { env, gateway, row, userId } from "./fixtures";

const key = `certificates/users/${userId}/${row.credential_id}/${"a".repeat(32)}-certificate.pdf`;
function setup(overrides: Record<string, unknown> = {}) {
  const mock = gateway();
  const bucket = {
    ...env.STORAGE_BUCKET,
    delete: vi.fn(),
    list: vi.fn().mockResolvedValue({ objects: [{ key }], truncated: false }),
  };
  const runtime = { ...env, STORAGE_BUCKET: bucket } as LteEnv;
  mock.read.mockResolvedValue([]);
  mock.rpc.mockImplementation(async (policy, options) =>
    policy.functionName === "claim_certificate_storage_cleanup"
      ? [
          {
            id: row.id,
            user_id: userId,
            certificate_id: row.id,
            object_key: key,
            prefix: null,
            lease_token: options.args.p_lease_token,
            ...overrides,
          },
        ]
      : null,
  );
  return { ...mock, bucket, runtime };
}
it("registers durable intent before uploading, and propagates database failure", async () => {
  const { qb, rpc } = gateway();
  await registerCertificateUpload(qb, row.id, key);
  expect(rpc).toHaveBeenCalledWith(
    expect.objectContaining({ functionName: "register_certificate_pdf_upload" }),
    { args: { p_certificate_id: row.id, p_object_key: key } },
  );
  rpc.mockRejectedValueOnce(new Error("DB unavailable"));
  await expect(registerCertificateUpload(qb, row.id, key)).rejects.toThrow();
});
it("deletes an unreferenced object and acknowledges only its lease", async () => {
  const { qb, rpc, bucket, runtime } = setup();
  expect(await drainCertificateStorageCleanup(qb, runtime, "request")).toBe(1);
  expect(bucket.delete).toHaveBeenCalledWith(key);
  expect(rpc.mock.calls.at(-1)?.[1].args).toMatchObject({ p_id: row.id, p_success: true });
  expect(rpc.mock.calls.at(-1)?.[1].args.p_lease_token).toBe(
    rpc.mock.calls[0]?.[1].args.p_lease_token,
  );
});
it("never deletes the current cache object", async () => {
  const { qb, read, bucket, runtime } = setup();
  read.mockResolvedValue([{ id: row.id }]);
  await drainCertificateStorageCleanup(qb, runtime, "request");
  expect(bucket.delete).not.toHaveBeenCalled();
});
it("keeps failed work durable for retry instead of acknowledging deletion", async () => {
  const { qb, rpc, bucket, runtime } = setup();
  bucket.delete.mockRejectedValue(new Error("R2 unavailable"));
  await drainCertificateStorageCleanup(qb, runtime, "request");
  expect(rpc.mock.calls.at(-1)?.[1].args.p_success).toBe(false);
});
it("erases a deleted learner prefix in bounded batches", async () => {
  const { qb, rpc, bucket, runtime } = setup({
    object_key: null,
    certificate_id: null,
    prefix: `certificates/users/${userId}/`,
  });
  bucket.list.mockResolvedValue({ objects: [{ key }], truncated: true });
  await drainCertificateStorageCleanup(qb, runtime, "request");
  expect(bucket.delete).toHaveBeenCalledWith([key]);
  expect(rpc.mock.calls.at(-1)?.[1].args.p_success).toBe(false);
});
it("does not erase prefixes while certificate rows still exist", async () => {
  const { qb, read, bucket, runtime } = setup({
    object_key: null,
    prefix: `certificates/users/${userId}/${row.credential_id}/`,
  });
  read.mockResolvedValue([row]);
  await drainCertificateStorageCleanup(qb, runtime, "request");
  expect(bucket.list).not.toHaveBeenCalled();
  expect(bucket.delete).not.toHaveBeenCalled();
});
it("rejects forged prefixes and mismatched leases without touching R2", async () => {
  const invalid = setup({ object_key: "outside/certificates" });
  await expect(
    drainCertificateStorageCleanup(invalid.qb, invalid.runtime, "request"),
  ).rejects.toThrow();
  expect(invalid.bucket.delete).not.toHaveBeenCalled();
  const mismatched = setup({ lease_token: crypto.randomUUID() });
  await drainCertificateStorageCleanup(mismatched.qb, mismatched.runtime, "request");
  expect(mismatched.bucket.delete).not.toHaveBeenCalled();
});
