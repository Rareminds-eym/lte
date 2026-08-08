// Re-export all functions for backward compatibility
export { getLevelWithModules } from "./levelQueries";
export { getModuleDetails } from "./moduleQueries";
export {
  recalculateLevelProgress,
  upsertLevelProgress,
  upsertModuleProgress,
  upsertStageProgress,
} from "./progressQueries";
