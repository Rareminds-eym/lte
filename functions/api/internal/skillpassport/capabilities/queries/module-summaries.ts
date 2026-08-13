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

  const [{ data: modulesData }, { data: levelProgressData }] = await Promise.all([
    supabase.from("modules").select("id, level_id").in("level_id", levelIds).eq("is_active", true),
    supabase
      .from("user_capability_level_progress")
      .select("level_id, status, completion_percentage")
      .eq("user_id", userId)
      .in("level_id", levelIds),
  ]);

  const modules = (modulesData ?? []) as Array<{ id: string; level_id: string }>;
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
  for (const row of (levelProgressData ?? []) as Array<{
    level_id: string;
    status: string;
    completion_percentage: number | null;
  }>) {
    levelProgressByLevel.set(row.level_id, row);
  }

  const { data: moduleProgressData } = moduleIds.length
    ? await supabase
        .from("user_module_progress")
        .select("module_id, module_status, completion_percentage")
        .eq("user_id", userId)
        .in("module_id", moduleIds)
    : { data: [] };

  const completedModuleByLevel: Record<string, number> = {};
  for (const row of (moduleProgressData ?? []) as Array<{
    module_id: string;
    module_status: string;
    completion_percentage: number | null;
  }>) {
    const levelId = moduleLevelById.get(row.module_id);
    if (!levelId) continue;
    if (
      row.module_status === "completed" ||
      row.module_status === "mastered" ||
      row.completion_percentage === 100
    ) {
      completedModuleByLevel[levelId] = (completedModuleByLevel[levelId] ?? 0) + 1;
    }
  }

  const result: Record<string, CapabilityModuleSummary> = {};
  for (const capabilityId of capabilityIds) {
    const capabilityLevels = levels
      .filter((lvl) => lvl.capability_id === capabilityId)
      .sort((a, b) => parseLevelNumber(a.level_code) - parseLevelNumber(b.level_code));
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
      perLevel.push({
        id: lvl.id,
        code: lvl.level_code,
        title: lvl.title,
        status: progress?.status ?? "not_started",
        completionPercentage: progress?.completion_percentage ?? 0,
        totalModules: totalModuleCount,
        completedModules: completedModuleCount,
      });
    }

    result[capabilityId] = { totalModules, completedModules, levels: perLevel };
  }

  return result;
}
