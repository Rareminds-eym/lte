import { z } from "zod";
import { createLogger } from "../shared/logger";
import { signServiceToken } from "./serviceToken";

const logger = createLogger("skill-gateway");

/**
 * Caller-side client for the LTE ↔ SkillPassport internal gateway
 * (`POST {SKILLPASSPORT_INTERNAL_URL}/api/internal/lte/v1`).
 *
 * This legacy HTTP gateway uses the shared HMAC service-token contract from
 * dev; it is separate from SSO's typed Service Binding RPC and auth-core user
 * authentication. Response envelopes are Zod-validated.
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
/** catalogue:get imports an entire role catalogue — allow 30s for large payloads. */
const CATALOGUE_TIMEOUT_MS = 30_000;
/** review:org-directory lists an organisation's learners and educators (administrator screens only). */
const DIRECTORY_TIMEOUT_MS = 10_000;
const timeoutFor = (action: string) =>
  action === "catalogue:get"
    ? CATALOGUE_TIMEOUT_MS
    : action === "review:org-directory"
      ? DIRECTORY_TIMEOUT_MS
      : GATEWAY_TIMEOUT_MS;
const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signUserClaim(secret: string, sub: string): Promise<{ claim: string; sig: string }> {
  const claim = b64urlEncode(
    encoder.encode(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 60 })),
  );
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(claim));
  return { claim, sig: b64urlEncode(new Uint8Array(signature)) };
}

const GatewayEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  requestId: z.string().optional(),
});

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

  const signal = AbortSignal.timeout(timeoutFor(action));
  try {
    const response = await fetch(`${baseUrl}/api/internal/lte/v1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceToken}`,
        "X-Lte-Claim": userClaim.claim,
        "X-Lte-Sig": userClaim.sig,
      },
      body: JSON.stringify({ action, requestId, payload }),
      signal,
    });
    // Keep the same deadline active until the entire response body is consumed.
    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      raw = null;
    }
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
  } catch (error) {
    if (error instanceof GatewayCallError) throw error;
    const aborted =
      signal.aborted ||
      (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name));
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
  }
}
