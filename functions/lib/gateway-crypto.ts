/**
 * Shared HS256 service-token + per-user claim crypto for the LTE ↔ SkillPassport
 * internal gateway. Used by BOTH directions inside LTE:
 *   - the caller client  (functions/lib/skill-gateway.ts — signs)
 *   - the server verifier (functions/api/internal/skillpassport/auth.ts — verifies)
 * Keep this in lockstep with the SkillPassport-side gateway auth (same scheme,
 * same shared secret) — the gateway-contract tests guard cross-repo drift.
 */

export class GatewayAuthError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" = "UNAUTHORIZED",
  ) {
    super(message);
    this.name = "GatewayAuthError";
  }
}

export interface ServiceTokenClaims {
  app: string;
  actions: string[];
  iat: number;
  exp: number;
  nbf?: number;
}

export interface UserClaim {
  sub: string;
  exp: number;
}

/** Raw, unvalidated shape of a decoded service-token claims object. */
interface RawServiceTokenClaims {
  app?: unknown;
  actions?: unknown;
  iat?: unknown;
  exp?: unknown;
  nbf?: unknown;
}

/** Raw, unvalidated shape of a decoded per-user claim payload. */
interface RawUserClaim {
  sub?: unknown;
  exp?: unknown;
}

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlDecodeString(input: string): string {
  return new TextDecoder().decode(b64urlDecode(input));
}

function b64urlDecodeSafe(input: string): Uint8Array<ArrayBuffer> {
  try {
    return b64urlDecode(input);
  } catch {
    throw new GatewayAuthError("Invalid token encoding", "BAD_REQUEST");
  }
}

function b64urlDecodeStringSafe(input: string): string {
  try {
    return b64urlDecodeString(input);
  } catch {
    throw new GatewayAuthError("Invalid token encoding", "BAD_REQUEST");
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export async function signServiceToken(
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

export async function verifyServiceToken(
  secret: string,
  token: string,
): Promise<ServiceTokenClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new GatewayAuthError("Malformed service token");

  const [header, payload, signature] = parts as [string, string, string];
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecodeSafe(signature),
    encoder.encode(`${header}.${payload}`),
  );
  if (!valid) throw new GatewayAuthError("Invalid service token signature");

  let claims: unknown;
  try {
    claims = JSON.parse(b64urlDecodeStringSafe(payload));
  } catch {
    throw new GatewayAuthError("Invalid service token payload");
  }

  const c = claims as RawServiceTokenClaims;
  if (
    typeof c.app !== "string" ||
    !Array.isArray(c.actions) ||
    typeof c.iat !== "number" ||
    typeof c.exp !== "number"
  ) {
    throw new GatewayAuthError("Invalid service token claims");
  }
  if (!c.actions.every((a) => typeof a === "string")) {
    throw new GatewayAuthError("Invalid service token actions");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > c.exp) throw new GatewayAuthError("Service token expired");
  if (typeof c.nbf === "number" && nowSec < c.nbf) {
    throw new GatewayAuthError("Service token not yet valid");
  }

  // Every field was validated above; only now is it narrowed into the typed claims.
  return {
    app: c.app,
    actions: c.actions as string[],
    iat: c.iat,
    exp: c.exp,
    ...(typeof c.nbf === "number" ? { nbf: c.nbf } : {}),
  };
}

export async function signUserClaim(
  secret: string,
  sub: string,
  ttlSeconds = 60,
): Promise<{ claim: string; sig: string }> {
  if (!isValidUUID(sub))
    throw new GatewayAuthError("User claim subject must be a UUID", "BAD_REQUEST");
  const claim = b64urlEncode(
    encoder.encode(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + ttlSeconds })),
  );
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(claim));
  return { claim, sig: b64urlEncode(new Uint8Array(sig)) };
}

export async function verifyUserClaim(
  secret: string,
  claim: string,
  signature: string,
): Promise<UserClaim> {
  if (!claim || !signature) throw new GatewayAuthError("Missing user claim");

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecodeSafe(signature),
    encoder.encode(claim),
  );
  if (!valid) throw new GatewayAuthError("Invalid user claim signature");

  let payload: unknown;
  try {
    payload = JSON.parse(b64urlDecodeStringSafe(claim));
  } catch {
    throw new GatewayAuthError("Invalid user claim payload");
  }

  const c = payload as RawUserClaim;
  if (typeof c.sub !== "string" || !isValidUUID(c.sub)) {
    throw new GatewayAuthError("Invalid user claim subject", "BAD_REQUEST");
  }
  if (typeof c.exp !== "number" || Math.floor(Date.now() / 1000) > c.exp) {
    throw new GatewayAuthError("User claim expired");
  }

  // c.sub / c.exp are validated above; only now are they narrowed into the typed claim.
  return { sub: c.sub, exp: c.exp };
}
