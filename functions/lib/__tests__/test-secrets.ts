/**
 * Centralized test-only HMAC signing key for the gateway auth tests.
 *
 * This key is ONLY used to mint the signed service-token/user-claim JWTs that
 * the SkillPassport gateway auth tests verify. It is a FAKE, inert fixture —
 * it must NEVER be used as a real gateway secret (production always reads the
 * `SKILLPASSPORT_INTERNAL_SECRET` binding). It is defined here once instead of
 * being copy-pasted across test files, and callers may override it via the
 * `TEST_GATEWAY_SECRET` env var when a CI/secret-vault setup requires it.
 */
export const TEST_GATEWAY_SECRET =
  process.env["TEST_GATEWAY_SECRET"] ?? "test-gateway-secret-that-is-at-least-32-chars";
