import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import {
  acknowledgeTrackActivation,
  authorizeTrackActivation,
  reserveTrackActivation,
  SubscriptionAccessError,
} from "@functions/lib/subscription-access";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { requireAuth } from "@functions/middleware";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPatch } from "../active-track";
import {
  activateLearningTrack,
  classifyTrackActivation,
  readCommittedTrackActivation,
} from "../queries";

vi.mock("@functions/middleware", async (original) => ({
  ...(await original<typeof import("@functions/middleware")>()),
  requireAuth: vi.fn(),
}));
vi.mock("@functions/lib/query-gateway", () => ({ createServiceQueryGateway: vi.fn() }));
vi.mock("@functions/lib/subscription-access", async (original) => ({
  ...(await original<typeof import("@functions/lib/subscription-access")>()),
  reserveTrackActivation: vi.fn(),
  acknowledgeTrackActivation: vi.fn(),
  authorizeTrackActivation: vi.fn(),
}));
vi.mock("../queries", () => ({
  activateLearningTrack: vi.fn(),
  readCommittedTrackActivation: vi.fn(),
  classifyTrackActivation: vi.fn(),
}));
const actor = "a0000000-0000-4000-8000-000000000001";
const trackId = "b0000000-0000-4000-8000-000000000001";
const operationId = "c0000000-0000-4000-8000-000000000001";
const run = (body: unknown) =>
  onRequestPatch({
    request: new Request("https://lte.invalid", { method: "PATCH", body: JSON.stringify(body) }),
    env: {},
  } as PagesContext<LteEnv>);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readCommittedTrackActivation).mockResolvedValue(null);
  vi.mocked(classifyTrackActivation).mockResolvedValue({ kind: "reservation_required" });
  vi.mocked(requireAuth).mockResolvedValue({ sub: actor } as Awaited<
    ReturnType<typeof requireAuth>
  >);
});
describe("activation subscription boundary ordering", () => {
  it.each([401, 403, 503] as const)("denies %s before a new resource write", async (status) => {
    vi.mocked(reserveTrackActivation).mockRejectedValue(new SubscriptionAccessError(status));
    expect((await run({ trackId, operationId })).status).toBe(status);
    expect(readCommittedTrackActivation).toHaveBeenCalledTimes(1);
    expect(activateLearningTrack).not.toHaveBeenCalled();
    expect(acknowledgeTrackActivation).not.toHaveBeenCalled();
  });
  it.each([
    { trackId },
    { trackId, operationId, limit: null },
    { trackId, operationId: "invalid" },
  ])("rejects caller policy or missing operation identity", async (body) => {
    expect((await run(body)).status).toBe(400);
    expect(reserveTrackActivation).not.toHaveBeenCalled();
    expect(createServiceQueryGateway).not.toHaveBeenCalled();
  });
  it("surfaces uncertain activation failure without sequential writes or retry", async () => {
    vi.mocked(reserveTrackActivation).mockResolvedValue(
      {} as Awaited<ReturnType<typeof reserveTrackActivation>>,
    );
    vi.mocked(activateLearningTrack).mockRejectedValue(new Error("private database failure"));
    const result = await run({ trackId, operationId });
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("private database failure");
    expect(activateLearningTrack).toHaveBeenCalledTimes(1);
  });
  it("does not report activation success when durable outcome acknowledgement is uncertain", async () => {
    const held = {} as Awaited<ReturnType<typeof reserveTrackActivation>>;
    const outcome = {} as Awaited<ReturnType<typeof activateLearningTrack>>;
    vi.mocked(reserveTrackActivation).mockResolvedValue(held);
    vi.mocked(activateLearningTrack).mockResolvedValue(outcome);
    const gateway = {} as ReturnType<typeof createServiceQueryGateway>;
    vi.mocked(createServiceQueryGateway).mockReturnValue(gateway);
    vi.mocked(acknowledgeTrackActivation).mockRejectedValue(
      new Error("private uncertain acknowledgement"),
    );
    const response = await run({ trackId, operationId });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private uncertain acknowledgement");
    expect(activateLearningTrack).toHaveBeenCalledExactlyOnceWith(
      gateway,
      actor,
      trackId,
      operationId,
      held,
    );
    expect(acknowledgeTrackActivation).toHaveBeenCalledExactlyOnceWith({}, held, outcome);
  });
  it("reconciles the exact retained commit without new write authority or reactivation", async () => {
    const recorded = { kind: "reserved", reservation: {}, outcome: {} } as NonNullable<
      Awaited<ReturnType<typeof readCommittedTrackActivation>>
    >;
    vi.mocked(readCommittedTrackActivation).mockResolvedValue(recorded);
    const gateway = {} as ReturnType<typeof createServiceQueryGateway>;
    vi.mocked(createServiceQueryGateway).mockReturnValue(gateway);
    expect((await run({ trackId, operationId })).status).toBe(200);
    expect(readCommittedTrackActivation).toHaveBeenCalledExactlyOnceWith(
      gateway,
      actor,
      trackId,
      operationId,
    );
    if (recorded.kind !== "reserved") throw new Error("fixture variant differs");
    expect(acknowledgeTrackActivation).toHaveBeenCalledExactlyOnceWith(
      {},
      recorded.reservation,
      recorded.outcome,
    );
    expect(reserveTrackActivation).not.toHaveBeenCalled();
    expect(activateLearningTrack).not.toHaveBeenCalled();
  });
  it("does not inspect retained outcomes without current authentication", async () => {
    const { AuthError } = await import("@functions/middleware");
    vi.mocked(requireAuth).mockRejectedValue(new AuthError("Missing token", "UNAUTHORIZED"));
    expect((await run({ trackId, operationId })).status).toBe(401);
    expect(readCommittedTrackActivation).not.toHaveBeenCalled();
    expect(acknowledgeTrackActivation).not.toHaveBeenCalled();
  });

  it("returns an authoritative already-active no-op without requesting shared capacity at full quota", async () => {
    vi.mocked(classifyTrackActivation).mockResolvedValue({ kind: "unchanged" } as Awaited<
      ReturnType<typeof classifyTrackActivation>
    >);
    vi.mocked(reserveTrackActivation).mockRejectedValue(new SubscriptionAccessError(402));
    expect((await run({ trackId, operationId })).status).toBe(200);
    expect(authorizeTrackActivation).toHaveBeenCalledTimes(1);
    expect(classifyTrackActivation).toHaveBeenCalledTimes(1);
    expect(reserveTrackActivation).not.toHaveBeenCalled();
    expect(activateLearningTrack).not.toHaveBeenCalled();
    expect(acknowledgeTrackActivation).not.toHaveBeenCalled();
  });
  it("does not reinterpret uncertain owner disposition as unchanged", async () => {
    vi.mocked(classifyTrackActivation).mockRejectedValue(new Error("owner uncertain"));
    expect((await run({ trackId, operationId })).status).toBe(503);
    expect(reserveTrackActivation).not.toHaveBeenCalled();
    expect(activateLearningTrack).not.toHaveBeenCalled();
  });
});
