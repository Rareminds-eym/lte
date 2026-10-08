import { z } from "zod";

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

const claimsSchema = z.object({
  app: z.string(),
  actions: z.array(z.string()),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
  nbf: z.number().int().optional(),
});
function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid service token");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) =>
    char.charCodeAt(0),
  );
}
export async function verifyServiceToken(secret: string, token: string) {
  if (secret.length < 32 || token.length > 8192) throw new Error("Invalid service token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid service token");
  const [header, payload, signature] = parts as [string, string, string];
  const decoder = new TextDecoder();
  z.object({ alg: z.literal("HS256"), typ: z.literal("svc").optional() }).parse(
    JSON.parse(decoder.decode(decode(header))),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      key,
      decode(signature) as BufferSource,
      encoder.encode(`${header}.${payload}`),
    ))
  )
    throw new Error("Invalid service token");
  const claims = claimsSchema.parse(JSON.parse(decoder.decode(decode(payload))));
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.exp <= now ||
    claims.iat > now ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > 300 ||
    (claims.nbf !== undefined && claims.nbf > now)
  )
    throw new Error("Invalid service token");
  return claims;
}
