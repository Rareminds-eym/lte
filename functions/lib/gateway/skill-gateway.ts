import { createLogger } from "../../shared/logger";
import { signServiceToken, signUserClaim } from "./gateway-crypto";
import { GatewayEnvelopeSchema } from "./gateway-envelope";

const logger = createLogger("skill-gateway");

/**
 * Caller-side client for the LTE ↔ SkillPassport internal gateway
 * (`POST {SKILLPASSPORT_INTERNAL_URL}/api/internal/lte/v1`).
 *
 * Signing is delegated to `@rareminds-eym/auth-core` (verifyJWT/createJWT
 * utilities) using the shared HMAC secret, then the gateway POSTs an action
 * envelope. Response is Zod-validated.
 *
 * Failure modes are typed: a non-ok / malformed / unreachable gateway throws
 * `GatewayCallError` — callers (learner-track) treat it as "fall through".
 */
export class GatewayCallError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "GatewayCallError";
  }
}

const GATEWAY_TIMEOUT_MS = 2000;

export interface SkillGatewayEnv {
  SKILLPASSPORT_INTERNAL_URL: string;
  SKILLPASSPORT_INTERNAL_SECRET: string;
}

/**
 * Call a gateway action on SkillPassport as user `userId`.
 * Returns the decoded `data` payload or throws GatewayCallError.
 */
export async function callSkill<T = unknown>(
  env: SkillGatewayEnv,
  action: string,
  payload: Record<string, unknown>,
  userId: string,
): Promise<T> {
  const baseUrl = env.SKILLPASSPORT_INTERNAL_URL?.replace(/\/+$/, "");
  const secret = env.SKILLPASSPORT_INTERNAL_SECRET;
  if (!baseUrl || !secret || secret.length < 32) {
    throw new GatewayCallError("Skill gateway env is not configured", "GATEWAY_MISCONFIGURED");
  }

  const requestId = crypto.randomUUID();
  const nowSec = Math.floor(Date.now() / 1000);
  const [serviceToken, userClaim] = await Promise.all([
    signServiceToken(secret, { app: "lte", actions: [action], iat: nowSec, exp: nowSec + 300 }),
    signUserClaim(secret, userId),
  ]);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/internal/lte/v1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceToken}`,
        "X-Lte-Claim": userClaim.claim,
        "X-Lte-Sig": userClaim.sig,
      },
      body: JSON.stringify({ action, requestId, payload }),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    logger.warn("Skill gateway request failed", {
      action,
      requestId,
      aborted,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new GatewayCallError(
      aborted ? "Skill gateway timed out" : "Skill gateway unreachable",
      aborted ? "GATEWAY_TIMEOUT" : "GATEWAY_UNREACHABLE",
    );
  } finally {
    clearTimeout(timer);
  }

  const raw: unknown = await response.json().catch(() => null);
  const parsed = GatewayEnvelopeSchema.safeParse(raw);
  if (!parsed.success || parsed.data.ok !== true) {
    const code =
      parsed.success && parsed.data.error?.code
        ? parsed.data.error.code
        : `HTTP_${response.status}`;
    const message =
      parsed.success && parsed.data.error?.message
        ? parsed.data.error.message
        : `Skill gateway returned ${response.status}`;
    logger.warn("Skill gateway action failed", {
      action,
      requestId,
      code,
      status: response.status,
    });
    throw new GatewayCallError(message, code);
  }

  return parsed.data.data as T;
}
