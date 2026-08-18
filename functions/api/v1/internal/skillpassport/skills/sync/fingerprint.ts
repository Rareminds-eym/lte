import type { SkillWithContext } from "../queries/get-skills";

/**
 * Skill fingerprint adapter. The content-only view (what should bump the hash)
 * is defined here and consumed by the shared `withFingerprints` helper in
 * `utils/fingerprint` — mirroring the capability fingerprint adapter.
 */

/**
 * Stable, content-only view of a skill used for change detection. Identifiers
 * (`id`, `levelId`) and timing (`completedAt`) are intentionally excluded so only
 * real content changes bump the fingerprint.
 */
export function skillFingerprintSource(skill: SkillWithContext): unknown {
  return {
    code: skill.code ?? null,
    name: skill.name,
    description: skill.description ?? null,
    tags: skill.tags ?? null,
    levelCode: skill.levelCode,
    levelTitle: skill.levelTitle,
    capabilityCode: skill.capabilityCode ?? null,
    capabilityName: skill.capabilityName,
    levelStatus: skill.levelStatus,
  };
}
