import { onRequestGet as internalPdf } from "@functions/api/v1/internal/certificates/[credentialId]/pdf";
import { onRequestGet as internalList } from "@functions/api/v1/internal/certificates/index";
import {
  onRequestOptions,
  onRequestGet as verify,
} from "@functions/api/v1/public/certificates/[credentialId]";
import { env, gateway, row, userId } from "@functions/lib/certificates/__tests__/fixtures";
import { ensureCertificatesForUser } from "@functions/lib/certificates/reconcile";
import { certificatePdf } from "@functions/lib/certificates/storage";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../_middleware";
import { onRequestGet as download } from "../[credentialId]/download";
import { onRequestGet as detail } from "../[credentialId]/index";
import { onRequestGet as list } from "../index";

vi.mock("@functions/lib/query-gateway", async (original) => ({
  ...(await original<typeof import("@functions/lib/query-gateway")>()),
  createServiceQueryGateway: vi.fn(),
}));
vi.mock("@functions/lib/certificates/reconcile", () => ({ ensureCertificatesForUser: vi.fn() }));
vi.mock("@functions/lib/certificates/storage", async (original) => ({
  ...(await original<typeof import("@functions/lib/certificates/storage")>()),
  certificatePdf: vi.fn(),
}));
vi.mock("@functions/middleware", async (original) => ({
  ...(await original<typeof import("@functions/middleware")>()),
  requireAuth: vi.fn(),
}));
function context(path = "", origin = env.SKILLPASSPORT_INTERNAL_URL) {
  return {
    request: new Request(`https://lte.test/api/v1/certificates${path}`, {
      headers: { Origin: origin, "CF-Connecting-IP": "203.0.113.1" },
    }),
    env: {
      ...env,
      RATE_LIMIT_KV: {
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
        put: vi.fn(),
      },
    },
    params: { credentialId: row.credential_id },
    data: { user: { sub: userId } },
    next: vi.fn().mockResolvedValue(new Response()),
  } as unknown as PagesContext;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(certificatePdf).mockResolvedValue(new Response("%PDF-test"));
});
describe("public verification", () => {
  it.each([
    "issued",
    "revoked",
    "pending_name",
    "absent",
  ])("returns minimal %s information with bounded caching", async (status) => {
    const { qb, read } = gateway();
    read.mockResolvedValue(
      status === "absent" ? null : { ...row, status, revoked_at: row.updated_at },
    );
    vi.mocked(createServiceQueryGateway).mockReturnValue(qb);
    const response = await verify(context());
    const body = await response.json();
    expect(body.status).toBe(
      status === "issued" ? "valid" : status === "revoked" ? "revoked" : "not_found",
    );
    for (const key of ["user_id", "userId", "email", "metadata", "pdf_object_key", "levelId"])
      expect(body).not.toHaveProperty(key);
    if (status === "revoked") expect(body).not.toHaveProperty("learnerName");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      env.SKILLPASSPORT_INTERNAL_URL,
    );
  });
  it("validates IDs, handles preflight, excludes other origins, and limits requests", async () => {
    const ctx = context();
    ctx.params["credentialId"] = "bad";
    expect((await verify(ctx)).status).toBe(400);
    expect(onRequestOptions(context()).status).toBe(204);
    expect(
      onRequestOptions(context("", "https://evil.test")).headers.has("Access-Control-Allow-Origin"),
    ).toBe(false);
    vi.mocked(ctx.env.RATE_LIMIT_KV!.list).mockResolvedValue({
      keys: Array.from({ length: 60 }, () => ({ name: "hit" })),
      list_complete: true,
    });
    expect((await verify(ctx)).status).toBe(429);
  });
});
it("enforces learner authentication and ownership without existence leaks", async () => {
  const ctx = context();
  ctx.data = {};
  expect((await detail(ctx)).status).toBe(401);
  vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Unauthorized", "UNAUTHORIZED"));
  expect((await onRequest(ctx)).status).toBe(401);
  vi.mocked(requireAuth).mockResolvedValueOnce({ sub: userId } as Awaited<
    ReturnType<typeof requireAuth>
  >);
  expect((await onRequest(ctx)).status).toBe(200);
  const { qb, read } = gateway();
  read.mockResolvedValue(null);
  vi.mocked(createServiceQueryGateway).mockReturnValue(qb);
  expect((await detail(context())).status).toBe(404);
  expect((await download(context())).status).toBe(404);
  expect(read.mock.calls[0]?.[0].ownership).toEqual({
    column: "user_id",
    source: "authenticatedUserId",
    required: true,
  });
  expect(read.mock.calls[0]?.[1].auth).toEqual({ userId });
});
it("returns learner summaries with correct links and download behavior", async () => {
  const { qb, read } = gateway();
  read.mockResolvedValue(row);
  vi.mocked(createServiceQueryGateway).mockReturnValue(qb);
  expect(await (await detail(context())).json()).toMatchObject({
    credentialId: row.credential_id,
    downloadable: true,
    verifyUrl: `${env.CERTIFICATE_VERIFY_BASE_URL}/${row.credential_id}`,
  });
  expect(await (await download(context())).text()).toBe("%PDF-test");
  read.mockResolvedValue([row]);
  const response = await list(context(`?type=course_completion&levelId=${row.level_id}`));
  expect(response.status).toBe(200);
  expect(ensureCertificatesForUser).toHaveBeenCalledOnce();
  expect(read.mock.calls.at(-1)?.[1].filters).toEqual([
    { column: "certificate_type", op: "eq", value: "course_completion" },
    { column: "level_id", op: "eq", value: row.level_id },
  ]);
  expect((await list(context("?type=wrong"))).status).toBe(400);
});
it("keeps stored certificates readable after reconciliation failure", async () => {
  const { qb, read } = gateway();
  read.mockResolvedValue([row]);
  vi.mocked(createServiceQueryGateway).mockReturnValue(qb);
  vi.mocked(ensureCertificatesForUser).mockRejectedValueOnce(new Error("issue failed"));
  expect((await list(context())).status).toBe(200);
});
it("serves internal pages and PDFs only behind service authentication", async () => {
  const { qb, read } = gateway();
  read.mockResolvedValue([row]);
  vi.mocked(createServiceQueryGateway).mockReturnValue(qb);
  const ctx = context(`?userId=${userId}`);
  ctx.data = { certificateServiceApp: "skillpassport" };
  expect(await (await internalList(ctx)).json()).toMatchObject({
    ok: true,
    data: { items: [expect.objectContaining({ userId, platform: "LTE" })] },
  });
  expect((await internalPdf(context())).status).toBe(401);
  read.mockResolvedValue(row);
  expect((await internalPdf(ctx)).status).toBe(200);
  read.mockResolvedValue(null);
  expect((await internalPdf(ctx)).status).toBe(404);
  ctx.params["credentialId"] = "bad";
  expect((await internalPdf(ctx)).status).toBe(400);
});
