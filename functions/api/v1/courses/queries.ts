// Re-export all functions for backward compatibility
export { getLevelWithModules } from "./levelQueries";
export { getModuleDetails } from "./moduleQueries";
export {
  recalculateLevelProgress,
  recalculateSubmissionLevelProgress,
  upsertLevelProgress,
  upsertModuleProgress,
  upsertStageProgress,
} from "./progressQueries";
