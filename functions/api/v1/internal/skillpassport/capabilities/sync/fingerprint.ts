import { computeFingerprint as hashSource } from "../../utils/fingerprint";
import type { CapabilityWithModules } from "../types";

/**
 * Capability fingerprint adapter. The content-only view (what should bump the
 * hash) is defined here and the actual SHA-256 hashing is delegated to the
 * shared generic `utils/fingerprint` so the hashing logic is not duplicated.
 */

/**
 * Stable, content-only view of a capability used for change detection.
 * Identifiers (`id`, `levels[].id`) and the origin-derived `resumeUrl` are
 * intentionally excluded so only real content changes bump the fingerprint.
 * Returns a plain object — hashed as-is by `utils/fingerprint`, matching the
 * skill adapter.
 */
export function fingerprintSource(cap: CapabilityWithModules): unknown {
  return {
    code: cap.code ?? null,
    name: cap.name,
    description: cap.description,
    roleName: cap.roleName ?? null,
    status: cap.status,
    currentLevel: cap.currentLevel,
    totalLevels: cap.totalLevels,
    durationHours: cap.durationHours ?? null,
    totalModules: cap.totalModules ?? 0,
    completedModules: cap.completedModules ?? 0,
    xp: cap.xp ?? null,
    targetLevel: cap.level ?? null,
    priority: cap.priority ?? null,
    levels: (cap.levels ?? []).map((lvl) => ({
      code: lvl.code,
      title: lvl.title,
      status: lvl.status,
      completionPercentage: lvl.completionPercentage,
      totalModules: lvl.totalModules,
      completedModules: lvl.completedModules,
      modules: (lvl.modules ?? []).map((mod) => ({
        title: mod.title,
        status: mod.status,
        completionPercentage: mod.completionPercentage,
      })),
    })),
  };
}

/** SHA-256 hex digest used as the per-course change fingerprint. */
export async function computeFingerprint(cap: CapabilityWithModules): Promise<string> {
  return hashSource(fingerprintSource(cap));
}
