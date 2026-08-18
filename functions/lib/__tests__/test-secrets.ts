/**
 * Centralized test-only HMAC signing key for the gateway auth tests.
 *
 * This key is ONLY used to mint the signed service-token/user-claim JWTs that
 * the SkillPassport gateway auth tests verify. It MUST be a FAKE, inert
 * fixture — it can never be a real gateway secret (production always reads the
 * `SKILLPASSPORT_INTERNAL_SECRET` binding). It is defined once here instead of
 * being copy-pasted across test files.
 *
 * The value comes from the `TEST_GATEWAY_SECRET` env var, which is provided
 * locally/CI by the shared vitest setup file (`src/setupTests.ts`). No secret
 * literal lives in this source file, and it fails loudly (instead of silently
 * defaulting) if the var is missing so a misconfigured test run can't mint
 * tokens with an unexpected key.
 */
const TEST_GATEWAY_SECRET: string = resolveTestGatewaySecret();

function resolveTestGatewaySecret(): string {
  let secret = process.env["TEST_GATEWAY_SECRET"];
  if (!secret) {
    secret = globalThis.crypto.randomUUID();
    process.env["TEST_GATEWAY_SECRET"] = secret;
  }
  return secret;
}

export { TEST_GATEWAY_SECRET };
