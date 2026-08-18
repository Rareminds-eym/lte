import { withFingerprints } from "../../utils/fingerprint";
import type { CapabilityWithModules, SyncCapability, SyncLevel, UserLevelProgress } from "../types";
import { fingerprintSource as capabilityFingerprintSource } from "./fingerprint";

const mapLevel = (level: UserLevelProgress): SyncLevel => ({
  id: level.id,
  code: level.code,
  title: level.title,
  status: level.status,
  completionPercentage: level.completionPercentage,
  totalModules: level.totalModules,
  completedModules: level.completedModules,
  modules: level.modules && level.modules.length > 0 ? level.modules : undefined,
});

/**
 * Trim a learner's capabilities to the SkillPassport sync payload, building each
 * `resumeUrl` deep-link against the request origin and a content `fingerprint`
 * (SHA-256 of the mutable course fields) that SkillPassport uses to skip
 * unchanged courses. When the origin is empty, `resumeUrl` is omitted.
 */
export async function mapCapabilitiesToSyncPayload(
  capabilities: CapabilityWithModules[],
  ltePublicUrl?: string,
): Promise<SyncCapability[]> {
  const base = (ltePublicUrl ?? "").replace(/\/+$/, "");
  // Attach a content fingerprint to each capability — Promise.all preserves order.
  const withFp = await withFingerprints(capabilities, capabilityFingerprintSource);
  return withFp.map(({ item: cap, fingerprint }) => mapCapability(cap, base, fingerprint));
}

/** Map one capability into its sync payload, using the precomputed fingerprint. */
function mapCapability(
  cap: CapabilityWithModules,
  base: string,
  fingerprint: string,
): SyncCapability {
  return {
    id: cap.id,
    code: cap.code,
    name: cap.name,
    description: cap.description,
    status: cap.status,
    currentLevel: cap.currentLevel,
    totalLevels: cap.totalLevels,
    durationHours: cap.durationHours,
    totalModules: cap.totalModules ?? 0,
    completedModules: cap.completedModules ?? 0,
    xp: cap.xp,
    targetLevel: cap.level,
    priority: cap.priority,
    levels: cap.levels && cap.levels.length > 0 ? cap.levels.map(mapLevel) : undefined,
    roleName: cap.roleName,
    resumeUrl: base ? `${base}/my-courses/${encodeURIComponent(cap.code ?? cap.id)}` : undefined,
    fingerprint,
  };
}
