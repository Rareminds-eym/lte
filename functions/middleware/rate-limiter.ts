/**
 * In-memory sliding-window rate limiter for artifact submission.
 *
 * Sliding window (not fixed window): a 429 is returned whenever more than
 * `max` hits fall inside the last `windowMs` — smooth bursts, no clock-edge
 * reset. Limits are passed per call so they stay env-configurable without a
 * factory or instance churn.
 */
import { jsonError } from "../lib/http";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>();

  private maxWindowMs = 60_000;

  /**
   * Records a hit for `key` and reports whether it is within the window.
   * `now` is injectable for tests.
   */
  check(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
    if (windowMs > this.maxWindowMs) this.maxWindowMs = windowMs;
    const cutoff = now - windowMs;
    const bucket = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (bucket.length >= max) {
      this.hits.set(key, bucket);
      const earliest = bucket[0]!;
      return { allowed: false, retryAfterMs: Math.max(1, earliest + windowMs - now) };
    }

    bucket.push(now);
    this.hits.set(key, bucket);

    // ponytail: per-isolate Map grows with distinct user ids; a lazy sweep
    // bounds it when it gets large. A global DB-backed limiter is the upgrade
    // path if multi-isolate accuracy ever matters.
    if (this.hits.size > 10_000) this.prune(now, windowMs);
    return { allowed: true, retryAfterMs: 0 };
  }

  /** Removes keys with no hits inside the window. */
  prune(now = Date.now(), windowMs = this.maxWindowMs): void {
    const cutoff = now - windowMs;
    for (const [key, bucket] of this.hits) {
      if (!bucket.some((t) => t > cutoff)) this.hits.delete(key);
    }
  }
}

export const rateLimiter = new SlidingWindowRateLimiter();

/** Structured 429 response with a Retry-After header. */
export function rateLimitErrorResponse(requestId: string, retryAfterMs: number): Response {
  return jsonError("Too many artifact submissions. Please wait before retrying.", 429, {
    code: "RATE_LIMITED",
    details: { retryAfterMs },
    requestId,
    headers: {
      "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
    },
  });
}
