import { drainCertificateStorageCleanup } from "@functions/lib/certificates";
import { env } from "@functions/lib/certificates/__tests__/fixtures";
import { signServiceToken } from "@functions/lib/serviceToken";
import type { PagesContext } from "@functions/lib/types";
import { beforeEach, expect, it, vi } from "vitest";
import { onRequest } from "../_middleware";
import { onRequestPost } from "../cleanup";

vi.mock("@functions/lib/certificates", async (original) => ({
  ...(await original<typeof import("@functions/lib/certificates")>()),
  drainCertificateStorageCleanup: vi.fn().mockResolvedValue(2),
}));
function context(app = "lte-maintenance", path = "", body?: string) {
  return {
    env,
    params: {},
    data: { certificateServiceApp: app },
    waitUntil: vi.fn(),
    request: new Request(`https://lte.test/api/v1/internal/certificates/cleanup${path}`, {
      method: "POST",
      body,
    }),
    next: vi.fn().mockResolvedValue(new Response()),
  } as unknown as PagesContext;
}
beforeEach(() => vi.clearAllMocks());
it("allows only maintenance callers and validates the empty command before I/O", async () => {
  expect((await onRequestPost(context("skillpassport"))).status).toBe(403);
  expect((await onRequestPost(context("lte-maintenance", "?userId=bad"))).status).toBe(400);
  expect((await onRequestPost(context("lte-maintenance", "", "{invalid"))).status).toBe(400);
  expect(drainCertificateStorageCleanup).not.toHaveBeenCalled();
  expect(await (await onRequestPost(context())).json()).toMatchObject({
    ok: true,
    data: { processed: 2 },
  });
});
it("requires a distinct app and cleanup action, so read tokens cannot drain jobs", async () => {
  const now = Math.floor(Date.now() / 1000);
  const ctx = context();
  const readToken = await signServiceToken(env.SKILLPASSPORT_INTERNAL_SECRET, {
    app: "skillpassport",
    actions: ["certificates.read"],
    iat: now,
    exp: now + 300,
  });
  ctx.request.headers.set("Authorization", `Bearer ${readToken}`);
  expect((await onRequest(ctx)).status).toBe(403);
  expect(ctx.next).not.toHaveBeenCalled();
  const token = await signServiceToken(env.SKILLPASSPORT_INTERNAL_SECRET, {
    app: "lte-maintenance",
    actions: ["certificates.cleanup"],
    iat: now,
    exp: now + 300,
  });
  ctx.request.headers.set("Authorization", `Bearer ${token}`);
  expect((await onRequest(ctx)).status).toBe(200);
});
it("sanitizes cleanup outages and preserves the internal envelope", async () => {
  vi.mocked(drainCertificateStorageCleanup).mockRejectedValueOnce(
    new Error("private database error"),
  );
  const response = await onRequestPost(context());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database error");
});
