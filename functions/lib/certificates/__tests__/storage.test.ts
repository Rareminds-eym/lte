import type { LteEnv } from "@functions/lib/types";
import { beforeEach, expect, it, vi } from "vitest";
import { renderPdf } from "../pdf-renderer";
import { certificatePdf } from "../storage";
import { CERTIFICATE_TEMPLATE_VERSION } from "../template";
import { env, gateway, row } from "./fixtures";

vi.mock("../pdf-renderer", () => ({ renderPdf: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
function setup() {
  const mock = gateway();
  mock.update.mockResolvedValue([{ id: row.id }]);
  const bucket = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({}),
    head: vi.fn(),
    delete: vi.fn(),
  };
  vi.mocked(renderPdf).mockResolvedValue(new TextEncoder().encode("%PDF-test").buffer);
  return { ...mock, bucket, runtime: { ...env, STORAGE_BUCKET: bucket } as unknown as LteEnv };
}
it("streams cached current PDFs without rendering", async () => {
  const { qb, bucket, runtime } = setup();
  bucket.get.mockResolvedValue({ body: "cached" });
  const response = await certificatePdf(
    qb,
    runtime,
    { ...row, pdf_object_key: "key", pdf_template_version: CERTIFICATE_TEMPLATE_VERSION },
    "request",
  );
  expect(await response.text()).toBe("cached");
  expect(renderPdf).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Content-Disposition")).toContain(row.credential_id);
});
it.each([
  null,
  0,
  CERTIFICATE_TEMPLATE_VERSION,
])("renders missing/stale cache version %s and uses random R2 keys", async (version) => {
  const { qb, bucket, update, runtime } = setup();
  const response = await certificatePdf(
    qb,
    runtime,
    { ...row, pdf_object_key: "old", pdf_template_version: version },
    "request",
  );
  expect(await response.text()).toBe("%PDF-test");
  expect(bucket.put.mock.calls[0]?.[0]).toMatch(
    /certificates\/users\/.+\/[a-f0-9]{32}-certificate\.pdf$/,
  );
  expect(update).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      data: expect.objectContaining({ pdf_template_version: CERTIFICATE_TEMPLATE_VERSION }),
    }),
  );
});
it.each([
  ["pending_name", 409],
  ["revoked", 410],
] as const)("rejects %s before any render", async (status, code) => {
  const { qb, runtime } = setup();
  await expect(certificatePdf(qb, runtime, { ...row, status }, "request")).rejects.toMatchObject({
    status: code,
  });
  expect(renderPdf).not.toHaveBeenCalled();
});
it.each([
  null,
  { ...row, status: "revoked" },
])("does not serve a PDF when erasure/revocation races its generation", async (current) => {
  const { qb, runtime, update, read, bucket } = setup();
  update.mockResolvedValue([]);
  read.mockResolvedValue(current);
  await expect(certificatePdf(qb, runtime, row, "request")).rejects.toMatchObject({
    status: current ? 410 : 404,
  });
  expect(bucket.delete).toHaveBeenCalledOnce();
});
it("propagates render failure and does not write an object", async () => {
  const { qb, runtime, bucket } = setup();
  vi.mocked(renderPdf).mockRejectedValue(new Error("failed"));
  await expect(certificatePdf(qb, runtime, row, "request")).rejects.toThrow("failed");
  expect(bucket.put).not.toHaveBeenCalled();
});
