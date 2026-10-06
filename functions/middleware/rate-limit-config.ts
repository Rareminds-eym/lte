/** Workers KV requires expirationTtl >= 60 seconds and bounds list pages. */
export const KV_RATE_LIMIT_CONFIG = {
  keyPrefix: "lte:rate-limit:v1",
  minTtlSeconds: 60,
  maxListPages: 10,
} as const;
