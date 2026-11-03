import type { RateLimitKvBinding } from "@functions/shared/types";
import { z } from "zod";
import { KV_RATE_LIMIT_CONFIG } from "./rate-limit-config";

const pageSchema = z.object({
  keys: z.array(z.object({ name: z.string() })),
  list_complete: z.boolean(),
  cursor: z.string().optional(),
});

/**
 * Best-effort fixed-window limiter backed by KV. Each request writes a unique
 * key, avoiding KV's one-write-per-second restriction on individual keys.
 * KV listing is eventually consistent: concurrent requests/regions can exceed
 * the limit. Storage failures propagate so callers return a sanitized 503.
 */
export async function checkDistributedRateLimit(
  kv: RateLimitKvBinding | undefined,
  userId: string,
  policy: { namespace: string; limit: number; windowSeconds: number },
) {
  if (!kv || typeof kv.list !== "function" || typeof kv.put !== "function") {
    throw new Error("RATE_LIMIT_KV binding is required");
  }
  const now = Date.now();
  const windowMs = policy.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const prefix = `${KV_RATE_LIMIT_CONFIG.keyPrefix}:${encodeURIComponent(policy.namespace)}:${encodeURIComponent(userId)}:${windowStart}:`;
  let count = 0;
  let cursor: string | undefined;
  for (let pageNo = 0; pageNo < KV_RATE_LIMIT_CONFIG.maxListPages; pageNo++) {
    const result = pageSchema.safeParse(
      await kv.list({ prefix, limit: policy.limit - count, ...(cursor ? { cursor } : {}) }),
    );
    if (!result.success) throw new Error("Invalid KV rate-limit listing", { cause: result.error });
    const page = result.data;
    count += page.keys.length;
    if (count >= policy.limit)
      return { allowed: false, retryAfterMs: Math.max(1, windowEnd - Date.now()) };
    if (page.list_complete) {
      // Await persistence: a failed write must not admit unrecorded requests.
      await kv.put(`${prefix}${crypto.randomUUID()}`, "", {
        expirationTtl: Math.max(
          KV_RATE_LIMIT_CONFIG.minTtlSeconds,
          Math.ceil((windowEnd - Date.now()) / 1000),
        ),
      });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (!page.cursor || page.cursor === cursor) throw new Error("Invalid KV rate-limit cursor");
    cursor = page.cursor;
  }
  throw new Error("KV rate-limit pagination exhausted");
}
