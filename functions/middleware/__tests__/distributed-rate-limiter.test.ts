import type { RateLimitKvBinding } from "@functions/shared/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkDistributedRateLimit } from "../distributed-rate-limiter";
import { KV_RATE_LIMIT_CONFIG } from "../rate-limit-config";

const policy = { namespace: "reviews", limit: 2, windowSeconds: 60 };
function fixture() {
  const keys = new Set<string>();
  const kv = {
    list: vi.fn(async ({ prefix, limit }: { prefix: string; limit: number }) => ({
      keys: [...keys]
        .filter((k) => k.startsWith(prefix))
        .slice(0, limit)
        .map((name) => ({ name })),
      list_complete: true,
    })),
    put: vi.fn(async (key: string, _value: string, _options: { expirationTtl: number }) => {
      keys.add(key);
    }),
  };
  return kv;
}
describe("KV rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:10Z"));
  });
  afterEach(() => vi.useRealTimers());
  it("shares a user's visible requests across callers and denies without another write", async () => {
    const kv = fixture();
    expect((await checkDistributedRateLimit(kv, "actor", policy)).allowed).toBe(true);
    expect((await checkDistributedRateLimit({ ...kv }, "actor", policy)).allowed).toBe(true);
    expect(await checkDistributedRateLimit(kv, "actor", policy)).toEqual({
      allowed: false,
      retryAfterMs: 50_000,
    });
    expect(kv.put).toHaveBeenCalledTimes(2);
    expect(kv.put.mock.calls[0]?.[0]).not.toBe(kv.put.mock.calls[1]?.[0]);
    expect(kv.put).toHaveBeenCalledWith(
      expect.stringContaining("lte:rate-limit:v1:reviews:actor:"),
      "",
      { expirationTtl: 60 },
    );
  });
  it("isolates users and policies, and uses a fresh prefix in the next window", async () => {
    const kv = fixture();
    await checkDistributedRateLimit(kv, "actor", { ...policy, limit: 1 });
    expect((await checkDistributedRateLimit(kv, "other", { ...policy, limit: 1 })).allowed).toBe(
      true,
    );
    expect(
      (
        await checkDistributedRateLimit(kv, "actor", {
          ...policy,
          namespace: "track-refresh",
          limit: 1,
        })
      ).allowed,
    ).toBe(true);
    vi.setSystemTime(new Date("2026-10-06T12:01:00Z"));
    expect((await checkDistributedRateLimit(kv, "actor", { ...policy, limit: 1 })).allowed).toBe(
      true,
    );
  });
  it("follows empty incomplete pages and retains the prefix when paginating", async () => {
    const kv = fixture();
    kv.list.mockResolvedValueOnce({ keys: [], list_complete: false, cursor: "next" } as Awaited<
      ReturnType<RateLimitKvBinding["list"]>
    >);
    await checkDistributedRateLimit(kv, "actor", policy);
    expect(kv.list).toHaveBeenNthCalledWith(2, { ...kv.list.mock.calls[0]?.[0], cursor: "next" });
    expect(kv.put).toHaveBeenCalledOnce();
  });
  it("uses unique keys even for simultaneous requests (KV is not an atomic quota)", async () => {
    const kv = fixture();
    await Promise.all([
      checkDistributedRateLimit(kv, "actor", { ...policy, limit: 1 }),
      checkDistributedRateLimit(kv, "actor", { ...policy, limit: 1 }),
    ]);
    expect(new Set(kv.put.mock.calls.map(([key]) => key)).size).toBe(2);
  });
  it.each(["list", "put"] as const)("fails closed on %s errors", async (method) => {
    const kv = fixture();
    kv[method].mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(checkDistributedRateLimit(kv, "actor", policy)).rejects.toThrow(
      "storage unavailable",
    );
  });
  it.each([
    null,
    {},
    { keys: [], list_complete: false },
    { keys: "bad", list_complete: true },
  ])("rejects malformed storage responses %j", async (page) => {
    const kv = fixture();
    kv.list.mockResolvedValueOnce(page as never);
    await expect(checkDistributedRateLimit(kv, "actor", policy)).rejects.toThrow(/Invalid KV/);
    expect(kv.put).not.toHaveBeenCalled();
  });
  it("requires the KV binding", async () => {
    await expect(checkDistributedRateLimit(undefined, "actor", policy)).rejects.toThrow(
      "RATE_LIMIT_KV",
    );
  });
  it("bounds pagination work on empty pages", async () => {
    const kv = fixture();
    let next = 0;
    kv.list.mockImplementation(async () => ({
      keys: [],
      list_complete: false,
      cursor: String(++next),
    }));
    await expect(checkDistributedRateLimit(kv, "actor", policy)).rejects.toThrow(
      "pagination exhausted",
    );
    expect(kv.list).toHaveBeenCalledTimes(KV_RATE_LIMIT_CONFIG.maxListPages);
    expect(kv.put).not.toHaveBeenCalled();
  });
});
