import { z } from "zod";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const credentialIdSchema = z.string().regex(/^LTE-[0-9A-HJKMNP-TV-Z]{16}$/);
export const isValidCredentialId = (value: string): boolean =>
  credentialIdSchema.safeParse(value).success;
export function generateCredentialId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let bits = 0;
  let value = 0;
  let id = "LTE-";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      id += alphabet[(value >>> bits) & 31];
    }
  }
  return id;
}
