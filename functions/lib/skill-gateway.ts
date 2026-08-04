import { z } from "zod";
import { createLogger } from "./logger";

const logger = createLogger("skill-gateway");

/**
 * Caller-side client for the LTE ↔ SkillPassport internal gateway
 * (`POST {SKILLPASSPORT_INTERNAL_URL}/api/internal/lte/v1`).
 *
 * Signs a scoped service token (app: "lte") and a 60s per-user claim with the
 * shared HMAC secret, then POSTs an action envelope. Response is Zod-validated.
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

async function signServiceToken(
  secret: string,
  claims: { app: string; actions: string[]; iat: number; exp: number },
): Promise<string> {
  const key = await hmacKey(secret);
  const header = b64urlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "svc" })));
  const payload = b64urlEncode(encoder.encode(JSON.stringify(claims)));
  const data = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${data}.${b64urlEncode(new Uint8Array(signature))}`;
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
