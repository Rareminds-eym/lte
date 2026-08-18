/**
 * Shared, reusable SHA-256 fingerprint for SkillPassport sync payloads.
 *
 * This is intentionally GENERIC: callers pass a stable, content-only view of
 * whatever they are syncing (a capability, a skill, ...) and get back a
 * deterministic hex digest. SkillPassport uses the digest as the delta-sync key
 * to skip unchanged rows, so identifiers and origin-derived fields (like a
 * deep-link) must be excluded from the `content` before hashing by the caller.
 */
export function fingerprintSource(content: unknown): string {
  return JSON.stringify(content);
}

/** SHA-256 hex digest of the given content. */
export async function computeFingerprint(content: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(fingerprintSource(content)),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Attach a content fingerprint to each item, preserving input order via
 * `Promise.all`. `toSource` returns the stable, content-only view of an item
 * (identifiers and origin-derived fields excluded). Reusable by every sync
 * payload mapper so the async fingerprint loop lives in one place.
 */
export async function withFingerprints<T>(
  items: T[],
  toSource: (item: T) => unknown,
): Promise<Array<{ item: T; fingerprint: string }>> {
  return Promise.all(
    items.map(async (item) => ({
      item,
      fingerprint: await computeFingerprint(toSource(item)),
    })),
  );
}
