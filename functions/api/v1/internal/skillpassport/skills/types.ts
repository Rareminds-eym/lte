/**
 * Shared types for the SkillPassport ← LTE skills sync.
 */

/** A single skill the learner "owns" (from a completed level), as synced to SP. */
export interface SyncSkill {
  id: string;
  code?: string;
  name: string;
  description?: string;
  tags?: string[];
  /** The completed level this skill is tied to. */
  levelId: string;
  levelCode: string;
  levelTitle: string;
  capabilityId: string;
  capabilityCode?: string;
  capabilityName: string;
  /** The owning level's progress status — always "completed" for owned skills. */
  levelStatus: string;
  completedAt?: string;
  /** Content fingerprint (SHA-256) for delta sync — SP skips unchanged skills. */
  fingerprint: string;
}
