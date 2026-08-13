import type { CapabilityWithModules, SyncCapability, SyncLevel, UserLevelProgress } from "../types";
import { computeFingerprint } from "./fingerprint";

const mapLevel = (level: UserLevelProgress): SyncLevel => ({
  id: level.id,
  code: level.code,
  title: level.title,
  status: level.status,
  completionPercentage: level.completionPercentage,
  totalModules: level.totalModules,
  completedModules: level.completedModules,
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
  const result: SyncCapability[] = [];
  for (const cap of capabilities) {
    result.push({
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
      levels: cap.levels && cap.levels.length > 0 ? cap.levels.map(mapLevel) : undefined,
      roleName: cap.roleName,
      resumeUrl: base ? `${base}/my-courses/${encodeURIComponent(cap.code ?? cap.id)}` : undefined,
      fingerprint: await computeFingerprint(cap),
    });
  }
  return result;
}
