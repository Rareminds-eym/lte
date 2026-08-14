import { describe, expect, it } from "vitest";
import {
  GatewayAuthError,
  isValidUUID,
  signServiceToken,
  signUserClaim,
  verifyServiceToken,
  verifyUserClaim,
} from "../gateway-crypto";

import { TEST_GATEWAY_SECRET as SECRET } from "./test-secrets";

const SUB = "11111111-1111-4111-8111-111111111111";

async function makeToken(payload: unknown, secret = SECRET): Promise<string> {
  const encoder = new TextEncoder();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "svc" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${Buffer.from(signature).toString("base64url")}`;
}

describe("GatewayAuthError", () => {
  it("defaults to the UNAUTHORIZED code and sets the error name", () => {
    const error = new GatewayAuthError("boom");
    expect(error.name).toBe("GatewayAuthError");
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("accepts a custom code", () => {
    const error = new GatewayAuthError("nope", "FORBIDDEN");
    expect(error.code).toBe("FORBIDDEN");
  });
});

describe("isValidUUID", () => {
  it("accepts valid UUID v4 strings", () => {
    expect(isValidUUID(SUB)).toBe(true);
  });

  it("rejects non-UUID and malformed values", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("")).toBe(false);
    expect(isValidUUID(SUB.toUpperCase())).toBe(true);
  });
});

describe("service tokens", () => {
  const now = () => Math.floor(Date.now() / 1000);

  it("signs and verifies a token roundtrip", async () => {
    const exp = now() + 300;
    const token = await signServiceToken(SECRET, {
      app: "skillpassport",
      actions: ["capabilities:get"],
      iat: now(),
      exp,
    });
    const claims = await verifyServiceToken(SECRET, token);
    expect(claims).toMatchObject({ app: "skillpassport", actions: ["capabilities:get"] });
    expect(claims.exp).toBe(exp);
  });

  it("rejects tokens signed with a different secret", async () => {
    const token = await signServiceToken(SECRET, {
      app: "skillpassport",
      actions: [],
      iat: now(),
      exp: now() + 300,
    });
    await expect(
      verifyServiceToken("a-different-secret-that-is-also-32-char", token),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Invalid service token signature" });
  });

  it("rejects malformed tokens", async () => {
    await expect(verifyServiceToken(SECRET, "two-parts")).rejects.toThrow(
      "Malformed service token",
    );
    await expect(verifyServiceToken(SECRET, "a.b.c.d")).rejects.toThrow("Malformed service token");
  });

  it("rejects tokens whose signature is not valid base64url", async () => {
    const token = await signServiceToken(SECRET, {
      app: "skillpassport",
      actions: [],
      iat: now(),
      exp: now() + 300,
    });
    const [header, payload] = token.split(".");
    await expect(verifyServiceToken(SECRET, `${header}.${payload}.!!!`)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invalid token encoding",
    });
  });

  it("rejects tokens whose payload is not valid JSON", async () => {
    const encoder = new TextEncoder();
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "svc" })).toString("base64url");
    const body = Buffer.from("not-json").toString("base64url");
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
    const token = `${header}.${body}.${Buffer.from(signature).toString("base64url")}`;
    await expect(verifyServiceToken(SECRET, token)).rejects.toThrow(
      "Invalid service token payload",
    );
  });

  it("rejects tokens with missing or wrong-typed claims", async () => {
    const token = await makeToken({ app: 123, actions: [], iat: now(), exp: now() + 300 });
    await expect(verifyServiceToken(SECRET, token)).rejects.toThrow("Invalid service token claims");
  });

  it("rejects tokens with non-string actions", async () => {
    const token = await makeToken({
      app: "skillpassport",
      actions: [1],
      iat: now(),
      exp: now() + 300,
    });
    await expect(verifyServiceToken(SECRET, token)).rejects.toThrow(
      "Invalid service token actions",
    );
  });

  it("rejects expired tokens", async () => {
    const token = await makeToken({
      app: "skillpassport",
      actions: [],
      iat: now() - 600,
      exp: now() - 300,
    });
    await expect(verifyServiceToken(SECRET, token)).rejects.toThrow("Service token expired");
  });

  it("rejects tokens that are not yet valid", async () => {
    const token = await makeToken({
      app: "skillpassport",
      actions: [],
      iat: now(),
      exp: now() + 300,
      nbf: now() + 120,
    });
    await expect(verifyServiceToken(SECRET, token)).rejects.toThrow("Service token not yet valid");
  });

  it("accepts tokens with a past nbf", async () => {
    const token = await makeToken({
      app: "skillpassport",
      actions: ["capabilities:get"],
      iat: now(),
      exp: now() + 300,
      nbf: now() - 120,
    });
    await expect(verifyServiceToken(SECRET, token)).resolves.toMatchObject({
      app: "skillpassport",
    });
  });
});

describe("user claims", () => {
  it("signs and verifies a claim roundtrip", async () => {
    const { claim, sig } = await signUserClaim(SECRET, SUB);
    const user = await verifyUserClaim(SECRET, claim, sig);
    expect(user.sub).toBe(SUB);
    expect(user.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a non-UUID subject at signing time", async () => {
    await expect(signUserClaim(SECRET, "not-a-uuid")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "User claim subject must be a UUID",
    });
  });

  it("rejects missing claim or signature", async () => {
    await expect(verifyUserClaim(SECRET, "", "sig")).rejects.toThrow("Missing user claim");
    await expect(verifyUserClaim(SECRET, "claim", "")).rejects.toThrow("Missing user claim");
  });

  it("rejects a claim with a tampered signature", async () => {
    const { sig } = await signUserClaim(SECRET, SUB);
    const tampered = Buffer.from(
      JSON.stringify({
        sub: "22222222-2222-4222-8222-222222222222",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString("base64url");
    await expect(verifyUserClaim(SECRET, tampered, sig)).rejects.toThrow(
      "Invalid user claim signature",
    );
  });

  it("rejects claims whose payload is not valid JSON", async () => {
    const claim = Buffer.from("not-json").toString("base64url");
    const sig = await makeSignature(claim);
    await expect(verifyUserClaim(SECRET, claim, sig)).rejects.toThrow("Invalid user claim payload");
  });

  it("rejects claims with an invalid subject", async () => {
    const claim = Buffer.from(
      JSON.stringify({ sub: "nope", exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString("base64url");
    const sig = await makeSignature(claim);
    await expect(verifyUserClaim(SECRET, claim, sig)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invalid user claim subject",
    });
  });

  it("rejects expired claims", async () => {
    const claim = Buffer.from(
      JSON.stringify({ sub: SUB, exp: Math.floor(Date.now() / 1000) - 30 }),
    ).toString("base64url");
    const sig = await makeSignature(claim);
    await expect(verifyUserClaim(SECRET, claim, sig)).rejects.toThrow("User claim expired");
  });
});

async function makeSignature(data: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Buffer.from(signature).toString("base64url");
}
