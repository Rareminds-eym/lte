import { describe, expect, it } from "vitest";
import { rateLimitErrorResponse, SlidingWindowRateLimiter } from "../rate-limiter";

describe("SlidingWindowRateLimiter", () => {
  it("allows hits up to the max within the window", () => {
    const limiter = new SlidingWindowRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(limiter.check("user-a", 3, 60_000, now + i)).toEqual({
        allowed: true,
        retryAfterMs: 0,
      });
    }
  });

  it("rejects a hit once the window is full", () => {
    const limiter = new SlidingWindowRateLimiter();
    const now = 1_000_000;
    limiter.check("user-a", 2, 60_000, now);
    limiter.check("user-a", 2, 60_000, now + 100);
    const result = limiter.check("user-a", 2, 60_000, now + 200);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("counts keys independently", () => {
    const limiter = new SlidingWindowRateLimiter();
    const now = 1_000_000;
    limiter.check("user-a", 1, 60_000, now);
    expect(limiter.check("user-b", 1, 60_000, now)).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.check("user-a", 1, 60_000, now + 10).allowed).toBe(false);
  });

  it("expires old hits when the window slides", () => {
    const limiter = new SlidingWindowRateLimiter();
    const now = 1_000_000;
    limiter.check("user-a", 1, 60_000, now);
    const result = limiter.check("user-a", 1, 60_000, now + 60_001);
    expect(result.allowed).toBe(true);
  });

  it("prunes keys with no recent hits", () => {
    const limiter = new SlidingWindowRateLimiter();
    const now = 1_000_000;
    limiter.check("stale", 5, 60_000, now - 120_000);
    limiter.check("fresh", 1, 60_000, now);
    limiter.prune(now);
    expect(limiter.check("stale", 5, 60_000, now).allowed).toBe(true);
    expect(limiter.check("fresh", 1, 60_000, now).allowed).toBe(false);
  });
});

describe("rateLimitErrorResponse", () => {
  it("returns 429 with Retry-After and structured body", async () => {
    const response = rateLimitErrorResponse("req-1", 30_500);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("31");
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
