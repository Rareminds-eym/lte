/**
 * LTE-side issuance of short-lived execution assertions for the AI worker.
 * Format `v1.<base64url(json)>.<base64url(hmac-sha256)>` must match the
 * worker's verifier exactly; any drift breaks every call closed-over by
 * contract tests on both sides. Mirrors the SkillPassport minter.
 *
 * Secret comes from `AI_ASSERT_SECRET` (Pages secret, never the browser).
 * Add it to `.dev.vars` locally and to dashboard secrets per environment.
 */

export interface LteAssertionClaimsInput {
  issuer: "lte";
  action: string;
  userId: string;
  tenantId?: string;
  product: string;
  entitlements: string[];
  /** Lifetime in ms. Short: 60s recommended. */
  ttlMs?: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Minimal WebCrypto surface this module needs. Structural: no DOM/worker lib required. */
interface HmacSubtle {
  importKey(
    format: string,
    keyData: Uint8Array,
    algorithm: { name: string; hash: string },
    extractable: boolean,
    usages: string[],
  ): Promise<unknown>;
  sign(algorithm: { name: string }, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
}

function subtle(): HmacSubtle {
  const holder = globalThis as unknown as { crypto?: { subtle?: unknown } };
  const candidate = holder.crypto?.subtle as HmacSubtle | undefined;
  if (!candidate || typeof candidate.importKey !== "function" || typeof candidate.sign !== "function") {
    throw new Error("WebCrypto unavailable for assertion issuance");
  }
  return candidate;
}

async function hmacKey(secret: string): Promise<unknown> {
  return subtle().importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

export async function issueExecutionAssertion(
  secret: string,
  claims: LteAssertionClaimsInput,
  nowMs = Date.now(),
): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error("AI_ASSERT_SECRET must be at least 32 characters");
  }
  const ttl = claims.ttlMs ?? 60000;
  const payload = {
    issuer: claims.issuer,
    audience: "ai-api",
    action: claims.action,
    userId: claims.userId,
    ...(claims.tenantId ? { tenantId: claims.tenantId } : {}),
    product: claims.product,
    entitlements: claims.entitlements,
    issuedAt: nowMs,
    expiresAt: nowMs + ttl,
  };
  const encoded = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(
    await subtle().sign({ name: "HMAC" }, await hmacKey(secret), new TextEncoder().encode(encoded)),
  );
  return `v1.${encoded}.${b64urlEncode(sig)}`;
}
