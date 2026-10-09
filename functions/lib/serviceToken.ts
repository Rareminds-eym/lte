import { z } from "zod";

const serviceClaimsSchema = z.object({
  app: z.string().min(1),
  actions: z.array(z.string().min(1)),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().nonnegative(),
  nbf: z.number().int().optional(),
});
const secretSchema = z.string().min(32);
const tokenSchema = z.string().min(1).max(8192);
const headerSchema = z.object({ alg: z.literal("HS256"), typ: z.literal("svc").optional() });
const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid service token");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) =>
    char.charCodeAt(0),
  );
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secretSchema.parse(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/** Legacy SkillPassport HTTP contract, matching dev's Web Crypto signer.
 * SSO RPC and browser/user authentication must continue to use auth-core. */
export async function signServiceToken(
  secret: string,
  claims: z.infer<typeof serviceClaimsSchema>,
): Promise<string> {
  const key = await hmacKey(secret, "sign");
  const header = b64urlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "svc" })));
  const payload = b64urlEncode(encoder.encode(JSON.stringify(serviceClaimsSchema.parse(claims))));
  const data = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return `${data}.${b64urlEncode(new Uint8Array(signature))}`;
}

export async function verifyServiceToken(secret: string, token: string) {
  const parts = tokenSchema.parse(token).split(".");
  if (parts.length !== 3) throw new Error("Invalid service token");
  const [header, payload, signature] = parts as [string, string, string];
  const decoder = new TextDecoder();
  headerSchema.parse(JSON.parse(decoder.decode(decode(header))));
  const key = await hmacKey(secret, "verify");
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      key,
      decode(signature) as BufferSource,
      encoder.encode(`${header}.${payload}`),
    ))
  )
    throw new Error("Invalid service token");
  const claims = serviceClaimsSchema.parse(JSON.parse(decoder.decode(decode(payload))));
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.exp <= now ||
    claims.iat > now ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > 300 ||
    (claims.nbf !== undefined && claims.nbf > now)
  )
    throw new Error("Invalid service token lifetime");
  return claims;
}
