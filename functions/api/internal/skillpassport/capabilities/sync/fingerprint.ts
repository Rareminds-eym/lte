import type { CapabilityWithModules } from "../types";

/**
 * Content fingerprint for change detection. Reusable pure helper — any caller
 * (the sync mapper today, a future LTE-side endpoint) can produce the same hash
 * for a capability.
 */

/**
 * Stable, content-only view of a capability used for change detection.
 * Identifiers (`id`, `levels[].id`) and the origin-derived `resumeUrl` are
 * intentionally excluded so only real content changes bump the fingerprint.
 */
export function fingerprintSource(cap: CapabilityWithModules): string {
  return JSON.stringify({
    code: cap.code ?? null,
    name: cap.name,
    description: cap.description,
    roleName: cap.roleName ?? null,
    status: cap.status,
    currentLevel: cap.currentLevel,
    totalLevels: cap.totalLevels,
    totalModules: cap.totalModules ?? 0,
    completedModules: cap.completedModules ?? 0,
    levels: (cap.levels ?? []).map((lvl) => ({
      code: lvl.code,
      title: lvl.title,
      status: lvl.status,
      completionPercentage: lvl.completionPercentage,
      totalModules: lvl.totalModules,
      completedModules: lvl.completedModules,
    })),
  });
}

/** SHA-256 hex digest used as the per-course change fingerprint. */
export async function computeFingerprint(cap: CapabilityWithModules): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(fingerprintSource(cap)),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
