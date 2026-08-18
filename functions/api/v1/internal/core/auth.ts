/**
 * Service-to-service auth for the internal gateway (e.g. `POST /api/internal/skillpassport`).
 *
 * The token scheme (HS256 service token + per-user claim) is shared and lives
 * in `@functions/lib/gateway/gateway-crypto` — used identically on the caller side.
 * This module re-exports it and adds the per-caller secret resolution.
 */

import { GatewayAuthError } from "@functions/lib/gateway/gateway-crypto";
import type { LteEnv } from "@functions/lib/types";

export type { ServiceTokenClaims, UserClaim } from "@functions/lib/gateway/gateway-crypto";
export {
  GatewayAuthError,
  isValidUUID,
  signServiceToken,
  signUserClaim,
  verifyServiceToken,
  verifyUserClaim,
} from "@functions/lib/gateway/gateway-crypto";

/**
 * Read a caller's gateway secret from the LTE environment (typed error if unset).
 * Each caller names its own env var (the caller registry's `secretEnvKey`), so one
 * project's key can never verify another project's tokens.
 */
export function getGatewaySecret(env: LteEnv, secretEnvKey: string): string {
  const secret = (env as unknown as Record<string, unknown>)[secretEnvKey];
  if (typeof secret !== "string" || secret.length < 32) {
    throw new GatewayAuthError("Gateway secret is missing or too short", "FORBIDDEN");
  }
  return secret;
}
