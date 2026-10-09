import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signServiceToken, verifyServiceToken } from "../serviceToken";

const secret = "s".repeat(64);
const now = 1_791_417_600;
const claims = { app: "skillpassport", actions: ["certificates.read"], iat: now, exp: now + 300 };

// Independent implementation of dev's wire format, not a round-trip through
// the production signer. These vectors protect the deployed HTTP contract.
function legacyToken(payload: unknown, header: unknown = { alg: "HS256", typ: "svc" }) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode(header)}.${encode(payload)}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

describe("legacy SkillPassport service tokens", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now * 1000);
  });
  afterEach(() => vi.useRealTimers());

  it("matches dev's signer byte-for-byte and accepts independently signed tokens", async () => {
    expect(await signServiceToken(secret, claims)).toBe(legacyToken(claims));
    expect(await verifyServiceToken(secret, legacyToken(claims))).toEqual(claims);
    expect(await verifyServiceToken(secret, legacyToken(claims, { alg: "HS256" }))).toEqual(claims);
  });

  it("rejects tampering, wrong secrets and malformed or oversized tokens", async () => {
    const token = legacyToken(claims);
    const [header, payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ ...claims, app: "lte" })).toString(
      "base64url",
    );
    for (const invalid of [
      "",
      "bad",
      `${token}x`,
      "x".repeat(8193),
      `${token}.extra`,
      `${header}.${tamperedPayload}.${signature}`,
      `${header}.${payload}.invalid!`,
    ])
      await expect(verifyServiceToken(secret, invalid)).rejects.toThrow();
    await expect(verifyServiceToken("t".repeat(64), token)).rejects.toThrow();
    await expect(verifyServiceToken("short", token)).rejects.toThrow();
    await expect(signServiceToken("short", claims)).rejects.toThrow();
  });

  it("rejects algorithm and type substitutions even with a valid HMAC", async () => {
    for (const header of [
      { alg: "none", typ: "svc" },
      { alg: "RS256", typ: "svc" },
      { alg: "HS256", typ: "JWT" },
    ])
      await expect(verifyServiceToken(secret, legacyToken(claims, header))).rejects.toThrow();
  });

  it("enforces bounded lifetimes, expiration and not-before claims", async () => {
    for (const payload of [
      { ...claims, exp: now },
      { ...claims, exp: now + 301 },
      { ...claims, iat: now + 1 },
      { ...claims, iat: now - 400 },
      { ...claims, nbf: now + 1 },
      { ...claims, exp: claims.iat },
    ])
      await expect(verifyServiceToken(secret, legacyToken(payload))).rejects.toThrow();
    expect(await verifyServiceToken(secret, legacyToken({ ...claims, nbf: now }))).toEqual({
      ...claims,
      nbf: now,
    });
  });

  it("validates claim types rather than trusting decoded JSON", async () => {
    for (const payload of [
      null,
      {},
      { ...claims, app: "" },
      { ...claims, actions: "certificates.read" },
      { ...claims, actions: [1] },
      { ...claims, iat: "now" },
      { ...claims, exp: 1.5 },
    ])
      await expect(verifyServiceToken(secret, legacyToken(payload))).rejects.toThrow();
  });
});
