import type { LteEnv, PagesContext } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../[[path]]";

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  read: vi.fn(),
  rpc: vi.fn(),
  assignment: vi.fn(),
  object: vi.fn(),
}));
vi.mock("@functions/middleware", () => ({
  getAuthUser: mocks.actor,
  rateLimiter: { check: () => ({ allowed: true }) },
  rateLimitErrorResponse: vi.fn(),
}));
vi.mock("@functions/lib/query-gateway", () => ({
  createServiceQueryGateway: () => ({ read: mocks.read, rpc: mocks.rpc }),
}));
vi.mock("@functions/lib/human-review/service", async (original) => ({
  ...(await original<typeof import("@functions/lib/human-review/service")>()),
  requireAssignment: mocks.assignment,
}));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const context = (path: string, init?: RequestInit) =>
  ({
    request: new Request(`https://lte.test/api/v1/reviews/${path}`, init),
    env: { STORAGE_BUCKET: { get: mocks.object } },
    data: {},
  }) as unknown as PagesContext<LteEnv>;
describe("review HTTP boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actor.mockReturnValue({ sub: id(1) });
    mocks.assignment.mockResolvedValue({ id: id(2), submission_id: id(3) });
  });
  it("rejects unauthenticated requests before reading assignments", async () => {
    mocks.actor.mockReturnValue(null);
    expect((await onRequest(context(id(2)))).status).toBe(401);
    expect(mocks.assignment).not.toHaveBeenCalled();
  });
  it("restricts file lookup to the authorized submission and never reads a foreign object", async () => {
    mocks.read.mockResolvedValue(null);
    expect(
      (await onRequest(context(`${id(2)}/files/${id(9)}/download?object_key=foreign`))).status,
    ).toBe(404);
    expect(mocks.read).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        filters: [
          { column: "id", op: "eq", value: id(9) },
          { column: "submission_id", op: "eq", value: id(3) },
        ],
      }),
    );
    expect(mocks.object).not.toHaveBeenCalled();
  });
  it("rejects injected identity fields before a start mutation", async () => {
    expect(
      (
        await onRequest(
          context(`${id(2)}/start`, {
            method: "POST",
            body: JSON.stringify({ expectedVersion: 2, reviewerId: id(9) }),
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("bounds a chunked review body independently of content-length", async () => {
    expect(
      (await onRequest(context(`${id(2)}/complete`, { method: "POST", body: "x".repeat(65537) })))
        .status,
    ).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("serves an authorized file only as an attachment with no browser cache", async () => {
    mocks.read.mockResolvedValue({ object_key: "owned/object", file_name: "evidence.html" });
    mocks.object.mockResolvedValue({ body: "<script>unsafe</script>" });
    const response = await onRequest(context(`${id(2)}/files/${id(9)}/download`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.object).toHaveBeenCalledWith("owned/object");
  });
});
