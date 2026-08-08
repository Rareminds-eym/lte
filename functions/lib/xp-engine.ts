/**
 * XP Engine — public barrel.
 *
 * All existing import paths (e.g. `from "@functions/lib/xp-engine"`) continue
 * to work without change. Primitives live in xp-engine.core.ts; domain logic
 * is split across xp-engine.artifacts.ts, xp-engine.progress.ts, and
 * xp-engine.engagement.ts.
 */

// Artifact evaluation
export {
  adminOverrideArtifact,
  completeStage,
  evaluateArtifact,
  evaluateFallback,
} from "./xp-engine.artifacts";
// Core primitives
export {
  awardXp,
  generateIdempotencyKey,
  XP_AMOUNTS,
  XP_CATEGORIES,
} from "./xp-engine.core";
export type { DailyLoginEngagementResult } from "./xp-engine.engagement";

// Engagement events
export {
  checkAndAwardConsistency,
  checkAndAwardLegacyBonus,
  checkAndAwardStreak,
  completeProfile,
  countConsecutiveDaysFromToday,
  evaluateMilestones,
  getUserTotalXp,
  triggerDailyLogin,
  triggerDailyLoginWithEngagement,
} from "./xp-engine.engagement";
// Learning progress
export {
  calculateReadiness,
  completeCapability,
  completeCourseOnTime,
  triggerReadinessRecalculation,
} from "./xp-engine.progress";
