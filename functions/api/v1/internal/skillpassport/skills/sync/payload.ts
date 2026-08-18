import { withFingerprints } from "../../utils/fingerprint";
import type { SkillWithContext } from "../queries/get-skills";
import type { SyncSkill } from "../types";
import { skillFingerprintSource } from "./fingerprint";

/**
 * Trim the learner's earned skills to the SkillPassport sync payload. Skills are
 * a flat list — unlike capabilities there is NO `resumeUrl` deep-link, because a
 * skill has no "continue learning" destination. Each entry carries a content
 * `fingerprint` for the delta sync (SP skips unchanged skills).
 */
export async function mapSkillsToSyncPayload(skills: SkillWithContext[]): Promise<SyncSkill[]> {
  const withFp = await withFingerprints(skills, skillFingerprintSource);
  return withFp.map(
    ({ item, fingerprint }): SyncSkill => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      tags: item.tags,
      levelId: item.levelId,
      levelCode: item.levelCode,
      levelTitle: item.levelTitle,
      capabilityId: item.capabilityId,
      capabilityCode: item.capabilityCode,
      capabilityName: item.capabilityName,
      levelStatus: item.levelStatus,
      completedAt: item.completedAt,
      fingerprint,
    }),
  );
}
