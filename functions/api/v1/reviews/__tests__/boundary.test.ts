import { REVIEW_CRITERIA } from "@functions/lib/human-review";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { XP_AMOUNTS } from "@functions/lib/xp-engine.core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../[[path]]";

const mocks = vi.hoisted(() => ({
  rate: vi.fn(),
  overview: vi.fn(),
  detail: vi.fn(),
  assign: vi.fn(),
  actor: vi.fn(),
  read: vi.fn(),
  rpc: vi.fn(),
  assignment: vi.fn(),
  recalculate: vi.fn(),
  object: vi.fn(),
}));
vi.mock("@functions/middleware", async (original) => ({
  ...(await original<typeof import("@functions/middleware")>()),
  getAuthUser: mocks.actor,
  checkDistributedRateLimit: mocks.rate,
}));
vi.mock("@functions/lib/query-gateway", () => ({
  createServiceQueryGateway: () => ({ read: mocks.read, rpc: mocks.rpc }),
}));
vi.mock("@functions/lib/human-review/service", async (original) => ({
  ...(await original<typeof import("@functions/lib/human-review/service")>()),
  requireAssignment: mocks.assignment,
}));
vi.mock("@functions/lib/human-review/operations", async (original) => ({
  ...(await original<typeof import("@functions/lib/human-review/operations")>()),
  adminOverview: mocks.overview,
  adminReviewDetail: mocks.detail,
  assignReview: mocks.assign,
}));
vi.mock("@functions/api/v1/courses/progressQueries", () => ({
  recalculateSubmissionLevelProgress: mocks.recalculate,
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
    mocks.rate.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    mocks.actor.mockReturnValue({ sub: id(1) });
    mocks.assignment.mockResolvedValue({ id: id(2), submission_id: id(3), learner_id: id(4) });
    mocks.recalculate.mockResolvedValue(undefined);
  });
  it("uses the KV binding and returns Retry-After before loading assignments", async () => {
    const ctx = context(id(2));
    ctx.env.RATE_LIMIT_KV = { list: vi.fn(), put: vi.fn() };
    mocks.rate.mockResolvedValueOnce({ allowed: false, retryAfterMs: 1500 });
    const response = await onRequest(ctx);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(mocks.rate).toHaveBeenCalledWith(
      ctx.env.RATE_LIMIT_KV,
      id(1),
      expect.objectContaining({ namespace: "reviews", limit: 60 }),
    );
    expect(mocks.assignment).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("fails closed with a sanitized 503 when KV fails", async () => {
    mocks.rate.mockRejectedValueOnce(new Error("private KV failure"));
    const response = await onRequest(context(id(2)));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private KV failure");
    expect(mocks.assignment).not.toHaveBeenCalled();
  });
  it("routes validated oversight queries to the administrator service", async () => {
    mocks.overview.mockResolvedValue({ items: [] });
    expect(
      (await onRequest(context("operations/overview?view=unassigned&page=2&q=Asha"))).status,
    ).toBe(200);
    expect(mocks.overview).toHaveBeenCalledWith(expect.anything(), expect.anything(), id(1), {
      view: "unassigned",
      page: 2,
      q: "Asha",
    });
    expect((await onRequest(context("operations/overview?page=0"))).status).toBe(400);
    expect(mocks.overview).toHaveBeenCalledOnce();
  });
  it("routes admin detail and validates reassignment before authorization queries", async () => {
    mocks.detail.mockResolvedValue({ review: {} });
    expect((await onRequest(context(`operations/${id(2)}`))).status).toBe(200);
    expect(mocks.detail).toHaveBeenCalledWith(expect.anything(), expect.anything(), id(1), id(2));
    expect(
      (
        await onRequest(
          context(`operations/${id(2)}/reassign`, {
            method: "POST",
            body: JSON.stringify({ reviewerId: "invalid" }),
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.assign).not.toHaveBeenCalled();
    mocks.assign.mockResolvedValue({ id: id(2) });
    const command = { reviewerId: id(4), expectedVersion: 2, reason: "Staff transfer" };
    expect(
      (
        await onRequest(
          context(`operations/${id(2)}/reassign`, {
            method: "POST",
            body: JSON.stringify(command),
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.assign).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      id(1),
      id(2),
      command,
    );
  });
  it("supplies canonical XP configuration only after validating completion", async () => {
    mocks.rpc.mockResolvedValue({ decision: "pass" });
    const command = {
      expectedVersion: 2,
      decision: "pass",
      feedback: "Meets standard",
      rationale: "Evidence verified",
      actionItems: [],
      hasCriticalFailure: false,
      criteria: REVIEW_CRITERIA.map((c) => ({ id: c.id, score: 3, evidence: "Observed" })),
    };
    const init = (body: unknown) => ({
      method: "POST",
      headers: { "Idempotency-Key": "complete-key" },
      body: JSON.stringify(body),
    });
    expect(
      (
        await onRequest(
          context(
            `${id(2)}/complete`,
            init({ ...command, xpRewards: { final_artifact_accepted_1: 999 } }),
          ),
        )
      ).status,
    ).toBe(400);
    expect(mocks.assignment).not.toHaveBeenCalled();
    expect((await onRequest(context(`${id(2)}/complete`, init(command)))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "complete_artifact_review" }),
      expect.objectContaining({
        args: expect.objectContaining({
          p_command: expect.objectContaining({ xpRewards: XP_AMOUNTS }),
        }),
      }),
    );
    expect(mocks.recalculate).toHaveBeenCalledWith(expect.anything(), id(4), id(3));
  });
  it("rejects unauthenticated requests before reading assignments", async () => {
    mocks.actor.mockReturnValue(null);
    expect((await onRequest(context(id(2)))).status).toBe(401);
    expect(mocks.assignment).not.toHaveBeenCalled();
  });
  it("rejects a missing idempotency key before loading the assignment", async () => {
    const response = await onRequest(
      context(`${id(2)}/complete`, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 2,
          decision: "pass",
          feedback: "Meets standard",
          rationale: "Evidence verified",
          actionItems: [],
          hasCriticalFailure: false,
          criteria: REVIEW_CRITERIA.map((c) => ({ id: c.id, score: 3, evidence: "Observed" })),
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(mocks.assignment).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
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
    expect(mocks.assignment).not.toHaveBeenCalled();
  });
  it("bounds a chunked review body independently of content-length", async () => {
    expect(
      (await onRequest(context(`${id(2)}/complete`, { method: "POST", body: "x".repeat(65537) })))
        .status,
    ).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.assignment).not.toHaveBeenCalled();
  });
  it("rejects a malformed file identifier before loading the assignment", async () => {
    expect((await onRequest(context(`${id(2)}/files/invalid/download`))).status).toBe(400);
    expect(mocks.assignment).not.toHaveBeenCalled();
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
