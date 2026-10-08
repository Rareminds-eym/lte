import { onRequest } from "@functions/api/v1/internal/certificates/_middleware";
import { onRequestGet } from "@functions/api/v1/internal/certificates/index";
import { signServiceToken, verifyServiceToken } from "@functions/lib/internal-service-token";
import type { PagesContext } from "@functions/lib/types";
import { beforeEach, expect, it, vi } from "vitest";
import { certificateError } from "../http";
import {
  internalItem,
  internalPage,
  internalQuerySchema,
  internalResponseSchema,
} from "../internal";
import { PdfRenderRateLimitedError, PdfRenderTimeoutError } from "../pdf-renderer";
import { CertificateDownloadError } from "../storage";
import { env, gateway, row, userId } from "./fixtures";

const secret = env.SKILLPASSPORT_INTERNAL_SECRET;
const claims = () => {
  const now = Math.floor(Date.now() / 1000);
  return { app: "skillpassport", actions: ["certificates.read"], iat: now, exp: now + 300 };
};
beforeEach(() => vi.clearAllMocks());
it("uses the unchanged service token wire format", async () => {
  const expected = claims();
  const token = await signServiceToken(secret, expected);
  expect(await verifyServiceToken(secret, token)).toEqual(expected);
  expect(JSON.parse(atob(token.split(".")[0]!))).toEqual({ alg: "HS256", typ: "svc" });
});
it("rejects invalid signatures, expired/future/overlong tokens and malformed claims", async () => {
  const token = await signServiceToken(secret, claims());
  for (const invalid of ["bad", "a.b.c", `${token}x`, "x".repeat(9000)])
    await expect(verifyServiceToken(secret, invalid)).rejects.toThrow();
  await expect(
    verifyServiceToken("different-secret-that-is-32-characters", token),
  ).rejects.toThrow();
  for (const value of [
    { ...claims(), exp: 1 },
    { ...claims(), exp: claims().exp + 1 },
    { ...claims(), iat: claims().iat + 60 },
    { ...claims(), nbf: claims().iat + 60 },
    { ...claims(), actions: "bad" },
  ]) {
    const signed = await signServiceToken(secret, value as ReturnType<typeof claims>);
    await expect(verifyServiceToken(secret, signed)).rejects.toThrow();
  }
});
function context(token?: string): PagesContext {
  return {
    request: new Request("https://lte.test/api/v1/internal/certificates", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
    env: {
      ...env,
      RATE_LIMIT_KV: {
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
        put: vi.fn(),
      },
    },
    params: {},
    next: vi.fn().mockResolvedValue(new Response("allowed")),
    data: {},
  } as unknown as PagesContext;
}
it("middleware returns 401 for absent/bad tokens and 403 for wrong app/action", async () => {
  expect((await onRequest(context())).status).toBe(401);
  expect((await onRequest(context("broken"))).status).toBe(401);
  for (const value of [
    { ...claims(), app: "lte" },
    { ...claims(), actions: ["other"] },
  ])
    expect((await onRequest(context(await signServiceToken(secret, value)))).status).toBe(403);
  expect((await onRequest(context(await signServiceToken(secret, claims())))).status).toBe(200);
  expect((await onRequestGet(context())).status).toBe(401);
});
it("middleware bounds app requests and fails closed on KV outages", async () => {
  const ctx = context(await signServiceToken(secret, claims()));
  vi.mocked(ctx.env.RATE_LIMIT_KV!.list).mockResolvedValue({
    keys: Array.from({ length: 600 }, () => ({ name: "hit" })),
    list_complete: true,
  });
  const response = await onRequest(ctx);
  expect(response.status).toBe(429);
  expect(await response.json()).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
  vi.mocked(ctx.env.RATE_LIMIT_KV!.list).mockRejectedValue(new Error("KV failed"));
  expect((await onRequest(ctx)).status).toBe(503);
});
it("validates internal modes, cursors, and field mapping", async () => {
  expect(() => internalQuerySchema.parse({})).toThrow();
  expect(() => internalQuerySchema.parse({ userId, updatedSince: row.updated_at })).toThrow();
  expect(() => internalQuerySchema.parse({ userId, limit: 101 })).toThrow();
  const mapped = internalItem(row, env as PagesContext["env"]);
  expect(
    internalResponseSchema.parse({ ok: true, data: { items: [mapped], nextCursor: null } }).data
      .items[0],
  ).toMatchObject({ platform: "LTE", issuedOn: "2026-10-08", status: "active", userId });
  expect(internalItem({ ...row, status: "revoked" }, env as PagesContext["env"]).status).toBe(
    "revoked",
  );
  const { qb } = gateway();
  for (const cursor of ["not base64!", btoa('{"updatedAt":"bad","id":"bad"}')])
    await expect(internalPage(qb, { userId, cursor, limit: 10 })).rejects.toThrow();
  await expect(
    internalPage(qb, {
      updatedSince: "2027-01-01T00:00:00Z",
      cursor: btoa(JSON.stringify({ updatedAt: row.updated_at, id: row.id })),
      limit: 10,
    }),
  ).rejects.toThrow();
});
it("pages equal timestamps by id then later timestamps without skipping ties", async () => {
  const { qb, read } = gateway();
  read.mockResolvedValueOnce([row]);
  const first = await internalPage(qb, { updatedSince: row.updated_at, limit: 1 });
  expect(first.nextCursor).toBeTruthy();
  read
    .mockResolvedValueOnce([{ ...row, id: userId }])
    .mockResolvedValueOnce([{ ...row, id: "later", updated_at: "2026-10-09T00:00:00Z" }]);
  const second = await internalPage(qb, {
    updatedSince: row.updated_at,
    cursor: first.nextCursor!,
    limit: 3,
  });
  expect(second.rows).toHaveLength(2);
  expect(second.nextCursor).toBeNull();
  expect(read.mock.calls[1]?.[1].filters).toContainEqual({ column: "id", op: "gt", value: row.id });
  expect(read.mock.calls[2]?.[1].filters).toContainEqual({
    column: "updated_at",
    op: "gt",
    value: row.updated_at,
  });
});
it("maps PDF errors to actionable status and retry headers", async () => {
  expect(
    certificateError(new CertificateDownloadError(410, "CERTIFICATE_REVOKED"), "req").status,
  ).toBe(410);
  const busy = certificateError(new PdfRenderRateLimitedError(15), "req");
  expect(busy.status).toBe(503);
  expect(busy.headers.get("Retry-After")).toBe("15");
  expect(await busy.json()).toMatchObject({ error: { details: { retryAfterMs: 15000 } } });
  expect(certificateError(new PdfRenderTimeoutError(), "req").status).toBe(503);
});
