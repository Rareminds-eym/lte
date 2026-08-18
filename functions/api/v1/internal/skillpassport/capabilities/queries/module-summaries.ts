import { apiLogger } from "@functions/shared/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserLevelProgress } from "../types";

/**
 * Per-capability course breakdown for the SkillPassport MyLearning sync.
 *
 * This lives inside the skillpassport gateway (not `api/v1/capabilities`) so we
 * can enrich the sync payload with the real level/module progress WITHOUT touching
 * the shared LTE capabilities queries/types. Its level/module math mirrors
 * `getUserCapabilityProgressSummaries` so the ladder and the capability progress
 * never disagree.
 */

/** Per-capability module totals + per-level progress ladder (levels → modules). */
export interface CapabilityModuleSummary {
  totalModules: number;
  completedModules: number;
  levels: UserLevelProgress[];
}

const PARSED_LEVEL = /L(\d+)/i;

function parseLevelNumber(levelCode: string): number {
  const match = levelCode.match(PARSED_LEVEL);
  return match ? Number.parseInt(match[1] ?? "1", 10) : 1;
}

/**
 * Compute, for each capability, the real course breakdown the learner sees:
 *   - how many published modules exist across its published levels
 *   - how many the learner has completed (from user_module_progress)
 *   - a per-level progress ladder (from user_capability_level_progress + levels + modules)
 *
 * Returns an empty object when none of the capability ids have published levels
 * (i.e. no course content seeded yet).
 */
export async function getCapabilityModuleSummaries(
  supabase: SupabaseClient,
  userId: string,
  capabilityIds: string[],
): Promise<Record<string, CapabilityModuleSummary>> {
  if (capabilityIds.length === 0) return {};

  const { data: levelsData, error: levelsError } = await supabase
    .from("levels")
    .select("id, capability_id, level_code, title")
    .in("capability_id", capabilityIds)
    .eq("is_active", true)
    .eq("status", "published");

  if (levelsError) {
    apiLogger.error("Failed to fetch capability module levels", levelsError);
    throw new Error(`Failed to fetch capability module levels: ${levelsError.message}`);
  }

  const levels = (levelsData ?? []) as Array<{
    id: string;
    capability_id: string;
    level_code: string;
    title: string;
  }>;
  if (levels.length === 0) return {};

  const levelIds = levels.map((lvl) => lvl.id);

  const [modulesResult, levelProgressResult] = await Promise.all([
    supabase
      .from("modules")
      .select("id, level_id, title")
      .in("level_id", levelIds)
      .eq("is_active", true),
    supabase
      .from("user_capability_level_progress")
      .select("level_id, status, completion_percentage")
      .eq("user_id", userId)
      .in("level_id", levelIds),
  ]).catch((error) => {
    // A hard network/transport failure rejects here (supabase only returns an
    // `.error` object for in-band failures). Surface WHICH query batch broke so
    // the failure is attributable instead of silently degrading.
    apiLogger.error("Failed to fetch module and level progress data", error);
    throw new Error(
      `Failed to fetch module and level progress data: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  });

  if (modulesResult.error) {
    apiLogger.error("Failed to fetch capability modules", modulesResult.error);
    throw new Error(`Failed to fetch capability modules: ${modulesResult.error.message}`);
  }
  if (levelProgressResult.error) {
    apiLogger.error("Failed to fetch capability level progress", levelProgressResult.error);
    throw new Error(
      `Failed to fetch capability level progress: ${levelProgressResult.error.message}`,
    );
  }

  const modules = (modulesResult.data ?? []) as Array<{
    id: string;
    level_id: string;
    title: string;
  }>;
  const moduleIds = modules.map((m) => m.id);
  const moduleLevelById = new Map(modules.map((m) => [m.id, m.level_id]));
  const moduleCountByLevel = modules.reduce<Record<string, number>>((counts, m) => {
    counts[m.level_id] = (counts[m.level_id] ?? 0) + 1;
    return counts;
  }, {});

  const levelProgressByLevel = new Map<
    string,
    { status: string; completion_percentage: number | null }
  >();
  for (const row of (levelProgressResult.data ?? []) as Array<{
    level_id: string;
    status: string;
    completion_percentage: number | null;
  }>) {
    levelProgressByLevel.set(row.level_id, row);
  }

  const moduleProgressResult = moduleIds.length
    ? await supabase
        .from("user_module_progress")
        .select("module_id, module_status, completion_percentage")
        .eq("user_id", userId)
        .in("module_id", moduleIds)
    : null;

  if (moduleProgressResult?.error) {
    apiLogger.error("Failed to fetch user module progress", moduleProgressResult.error);
    throw new Error(`Failed to fetch user module progress: ${moduleProgressResult.error.message}`);
  }

  const moduleProgressData = moduleProgressResult?.data ?? [];

  const completedModuleByLevel: Record<string, number> = {};
  const moduleProgressByModule = new Map<
    string,
    { status: string; completionPercentage: number }
  >();
  for (const row of (moduleProgressData ?? []) as Array<{
    module_id: string;
    module_status: string;
    completion_percentage: number | null;
  }>) {
    const levelId = moduleLevelById.get(row.module_id);
    if (!levelId) continue;
    const isDone =
      row.module_status === "completed" ||
      row.module_status === "mastered" ||
      row.completion_percentage === 100;
    if (isDone) {
      completedModuleByLevel[levelId] = (completedModuleByLevel[levelId] ?? 0) + 1;
    }
    moduleProgressByModule.set(row.module_id, {
      status: isDone ? "completed" : row.module_status,
      completionPercentage: row.completion_percentage ?? 0,
    });
  }

  const result: Record<string, CapabilityModuleSummary> = {};
  for (const capabilityId of capabilityIds) {
    const capabilityLevels = levels
      .filter((lvl) => lvl.capability_id === capabilityId)
      .sort((a, b) => {
        const rank = parseLevelNumber(a.level_code) - parseLevelNumber(b.level_code);
        return rank !== 0 ? rank : a.title.localeCompare(b.title);
      });
    if (capabilityLevels.length === 0) continue;

    const perLevel: UserLevelProgress[] = [];
    let totalModules = 0;
    let completedModules = 0;

    for (const lvl of capabilityLevels) {
      const totalModuleCount = moduleCountByLevel[lvl.id] ?? 0;
      const completedModuleCount = completedModuleByLevel[lvl.id] ?? 0;
      totalModules += totalModuleCount;
      completedModules += completedModuleCount;

      const progress = levelProgressByLevel.get(lvl.id);
      const levelModules = modules
        .filter((m) => m.level_id === lvl.id)
        .map((m) => {
          const moduleProgress = moduleProgressByModule.get(m.id);
          return {
            id: m.id,
            title: m.title,
            status: moduleProgress?.status ?? "not_started",
            completionPercentage: moduleProgress?.completionPercentage ?? 0,
          };
        });
      perLevel.push({
        id: lvl.id,
        code: lvl.level_code,
        title: lvl.title,
        status: progress?.status ?? "not_started",
        completionPercentage: progress?.completion_percentage ?? 0,
        totalModules: totalModuleCount,
        completedModules: completedModuleCount,
        modules: levelModules,
      });
    }

    result[capabilityId] = { totalModules, completedModules, levels: perLevel };
  }

  return result;
}
