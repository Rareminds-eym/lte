/**
 * Service-to-service auth for the SkillPassport → LTE internal gateway
 * (`POST /api/internal/skillpassport`).
 *
 * The token scheme (HS256 service token + per-user claim) is shared and lives
 * in `@functions/lib/gateway-crypto` — used identically on the SP caller side.
 * This module re-exports it and adds the LTE-specific secret resolution.
 */

import { GatewayAuthError } from "@functions/lib/gateway-crypto";
import type { LteEnv } from "@functions/lib/types";

export type { ServiceTokenClaims, UserClaim } from "@functions/lib/gateway-crypto";
export {
  GatewayAuthError,
  isValidUUID,
  signServiceToken,
  signUserClaim,
  verifyServiceToken,
  verifyUserClaim,
} from "@functions/lib/gateway-crypto";

/** Read the shared gateway secret from the LTE environment (typed error if unset). */
export function getGatewaySecret(env: LteEnv): string {
  const secret = env.SKILLPASSPORT_INTERNAL_SECRET;
  if (!secret || secret.length < 32) {
    throw new GatewayAuthError("Gateway secret is missing or too short", "FORBIDDEN");
  }
  return secret;
}
