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
  // Parallelize the (async) fingerprint computation — Promise.all preserves input order.
  return Promise.all(capabilities.map((cap) => mapCapability(cap, base)));
}

/**
 * Map one capability into its sync payload. The fingerprint hashing is the only
 * fallible step, so it is isolated so a failure names WHICH course broke the
 * batch instead of a bare rejection from `Promise.all`.
 */
async function mapCapability(cap: CapabilityWithModules, base: string): Promise<SyncCapability> {
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
    levels: cap.levels && cap.levels.length > 0 ? cap.levels.map(mapLevel) : undefined,
    roleName: cap.roleName,
    resumeUrl: base ? `${base}/my-courses/${encodeURIComponent(cap.code ?? cap.id)}` : undefined,
    fingerprint: await computeCapabilityFingerprint(cap),
  };
}

/**
 * Content fingerprint with a contextual error on failure, so a batch failure
 * identifies the capability (and reason) that broke it.
 */
async function computeCapabilityFingerprint(cap: CapabilityWithModules): Promise<string> {
  try {
    return await computeFingerprint(cap);
  } catch (error) {
    throw new Error(
      `Failed to compute sync fingerprint for capability ${cap.code ?? cap.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
