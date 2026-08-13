import type { UserCapability } from "@functions/api/v1/capabilities/types";

/**
 * Shared types for the SkillPassport ↔ LTE capabilities sync.
 * Kept in one module so the sync helpers, data query and action handlers all
 * speak the same vocabulary.
 */

/** A single level inside a capability — the progress ladder the learner sees. */
export interface UserLevelProgress {
  id: string;
  code: string;
  title: string;
  status: string;
  completionPercentage: number;
  totalModules: number;
  completedModules: number;
}

/** A capability enriched with the real level/module breakdown before syncing. */
export type CapabilityWithModules = UserCapability & {
  totalModules?: number;
  completedModules?: number;
  levels?: UserLevelProgress[];
};

/** A single level as it appears in the SkillPassport sync payload. */
export interface SyncLevel {
  id: string;
  code: string;
  title: string;
  status: string;
  completionPercentage: number;
  totalModules: number;
  completedModules: number;
}

/** The trimmed per-course payload returned to SkillPassport. */
export interface SyncCapability {
  id: string;
  code?: string;
  name: string;
  description: string;
  status: string;
  currentLevel: number;
  totalLevels: number;
  durationHours: number;
  /** Total published modules across the capability's levels. */
  totalModules: number;
  /** Modules the learner has completed across its levels. */
  completedModules: number;
  /** Per-level progress ladder; absent when the capability has no published levels. */
  levels?: SyncLevel[];
  roleName?: string;
  resumeUrl?: string;
  /** Content fingerprint (SHA-256) for delta sync — SP skips unchanged courses. */
  fingerprint: string;
}
