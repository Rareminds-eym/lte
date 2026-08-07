import { apiLogger } from "@functions/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Capability,
  CapabilityLevel,
  RoleCapabilitySequenceRow,
  UserCapability,
} from "./types";

export async function getCapabilitiesByRoleId(
  supabase: SupabaseClient,
  roleId: string,
): Promise<Capability[]> {
  const { data, error } = await supabase
    .from("role_capability_sequence")
    .select(`
      id,
      sequence_step,
      required_level,
      capability_priority,
      capabilities (
        id,
        code,
        name,
        description
      )
    `)
    .eq("role_id", roleId)
    .order("sequence_step", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch role capabilities: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((item: RoleCapabilitySequenceRow) => {
    const cap = Array.isArray(item.capabilities) ? item.capabilities[0] : item.capabilities;

    return {
      id: cap?.id ?? "",
      name: cap?.name ?? "",
      description: cap?.description ?? "",
      code: cap?.code ?? undefined,
      level: item.required_level ?? undefined,
      priority: item.capability_priority ?? undefined,
      step: item.sequence_step ?? undefined,
    };
  });
}

export async function getLevelStatsForCapabilities(
  supabase: SupabaseClient,
  capabilityIds: string[],
): Promise<{
  counts: Record<string, number>;
  xpSums: Record<string, number>;
  durationHours: Record<string, number>;
}> {
  if (capabilityIds.length === 0) return { counts: {}, xpSums: {}, durationHours: {} };

  const { data, error } = await supabase
    .from("levels")
    .select("capability_id, id, total_xp, duration_minutes")
    .in("capability_id", capabilityIds)
    .eq("is_active", true)
    .eq("status", "published");

  if (error) {
    throw new Error(`Failed to fetch level counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  const xpSums: Record<string, number> = {};
  const durationMinutes: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{
    capability_id: string;
    id: string;
    total_xp?: number;
    duration_minutes?: number | null;
  }>) {
    counts[row.capability_id] = (counts[row.capability_id] ?? 0) + 1;
    xpSums[row.capability_id] = (xpSums[row.capability_id] ?? 0) + (row.total_xp ?? 0);
    durationMinutes[row.capability_id] =
      (durationMinutes[row.capability_id] ?? 0) + (row.duration_minutes ?? 0);
  }
  const durationHours = Object.fromEntries(
    Object.entries(durationMinutes).map(([capabilityId, minutes]) => [
      capabilityId,
      Math.round(minutes / 60),
    ]),
  );

  return { counts, xpSums, durationHours };
}

interface CapabilityProgressSummary {
  currentLevel: number;
  status: "not_started" | "in_progress" | "completed";
  progress: number;
}

const parseLevelNumber = (levelCode: string) =>
  parseInt(levelCode.match(/L(\d+)/i)?.[1] ?? "1", 10);

export async function getUserCapabilityProgressSummaries(
  supabase: SupabaseClient,
  userId: string,
  capabilityIds: string[],
): Promise<Record<string, CapabilityProgressSummary>> {
  if (capabilityIds.length === 0) return {};

  const { data: levels, error: levelsError } = await supabase
    .from("levels")
    .select("id, capability_id, level_code")
    .in("capability_id", capabilityIds)
    .eq("is_active", true)
    .eq("status", "published");

  if (levelsError) {
    throw new Error(`Failed to fetch capability progress levels: ${levelsError.message}`);
  }

  const levelRows = (levels ?? []) as Array<{
    id: string;
    capability_id: string;
    level_code: string;
  }>;
  const levelIds = levelRows.map((level) => level.id);
  if (levelIds.length === 0) return {};

  const { data: moduleRows, error: modulesError } = await supabase
    .from("modules")
    .select("id, level_id")
    .in("level_id", levelIds)
    .eq("is_active", true);

  if (modulesError) {
    throw new Error(`Failed to fetch capability progress modules: ${modulesError.message}`);
  }

  const modules = (moduleRows ?? []) as Array<{ id: string; level_id: string }>;
  const moduleIds = modules.map((module) => module.id);
  const moduleLevelById = new Map(modules.map((module) => [module.id, module.level_id]));
  const moduleCountByLevel = modules.reduce<Record<string, number>>((counts, module) => {
    counts[module.level_id] = (counts[module.level_id] ?? 0) + 1;
    return counts;
  }, {});

  const { data: moduleProgressRows, error: moduleProgressError } = moduleIds.length
    ? await supabase
        .from("user_module_progress")
        .select("module_id, module_status, completion_percentage")
        .eq("user_id", userId)
        .in("module_id", moduleIds)
    : { data: [], error: null };

  if (moduleProgressError) {
    throw new Error(`Failed to fetch user module progress: ${moduleProgressError.message}`);
  }

  const completedModuleCountByLevel: Record<string, number> = {};
  const moduleProgressSumByLevel: Record<string, number> = {};
  for (const progress of (moduleProgressRows ?? []) as Array<{
    module_id: string;
    module_status: string;
    completion_percentage: number | null;
  }>) {
    const levelId = moduleLevelById.get(progress.module_id);
    if (!levelId) continue;

    moduleProgressSumByLevel[levelId] =
      (moduleProgressSumByLevel[levelId] ?? 0) + (progress.completion_percentage ?? 0);
    if (
      progress.module_status === "completed" ||
      progress.module_status === "mastered" ||
      progress.completion_percentage === 100
    ) {
      completedModuleCountByLevel[levelId] = (completedModuleCountByLevel[levelId] ?? 0) + 1;
    }
  }

  const summaries: Record<string, CapabilityProgressSummary> = {};
  for (const capabilityId of capabilityIds) {
    const capabilityLevels = levelRows
      .filter((level) => level.capability_id === capabilityId)
      .sort((a, b) => parseLevelNumber(a.level_code) - parseLevelNumber(b.level_code));
    const totalLevels = capabilityLevels.length;
    if (totalLevels === 0) continue;

    let completedLevels = 0;
    let progressSum = 0;

    for (const level of capabilityLevels) {
      const moduleCount = moduleCountByLevel[level.id] ?? 0;
      const completedModuleCount = completedModuleCountByLevel[level.id] ?? 0;
      const levelProgress =
        moduleCount > 0 ? Math.round((moduleProgressSumByLevel[level.id] ?? 0) / moduleCount) : 0;

      progressSum += levelProgress;
      if (moduleCount > 0 && completedModuleCount >= moduleCount) {
        completedLevels += 1;
      }
    }

    const progress = Math.round(progressSum / totalLevels);
    summaries[capabilityId] = {
      currentLevel: completedLevels,
      status:
        completedLevels === 0
          ? "not_started"
          : completedLevels >= totalLevels
            ? "completed"
            : "in_progress",
      progress,
    };
  }

  return summaries;
}

export async function getUserCapabilitiesForRoles(
  supabase: SupabaseClient,
  userId: string,
  roleIds: string[],
  rolesInfo: Array<{ roleId: string; roleName: string }>,
): Promise<UserCapability[]> {
  if (roleIds.length === 0) return [];

  const combinedCapabilities: UserCapability[] = [];
  const roleNameMap = new Map<string, string>(rolesInfo.map((r) => [r.roleId, r.roleName]));

  for (const roleId of roleIds) {
    const capabilities = await getCapabilitiesByRoleId(supabase, roleId);
    if (capabilities.length === 0) continue;

    const capIds = capabilities.map((c) => c.id);
    const {
      counts: levelCounts,
      xpSums,
      durationHours,
    } = await getLevelStatsForCapabilities(supabase, capIds);
    const progressSummaries = await getUserCapabilityProgressSummaries(supabase, userId, capIds);
    const roleName = roleNameMap.get(roleId) ?? "";

    const userCaps = capabilities.map((cap) => {
      const progressSummary = progressSummaries[cap.id];

      return {
        id: cap.id,
        name: cap.name,
        description: cap.description,
        code: cap.code,
        level: cap.level,
        priority: cap.priority ?? "",
        step: cap.step,
        totalLevels: levelCounts[cap.id] ?? 0,
        currentLevel: progressSummary?.currentLevel ?? 0,
        status: progressSummary?.status ?? "not_started",
        progress: progressSummary?.progress ?? 0,
        durationHours: durationHours[cap.id] ?? 0,
        xp: xpSums[cap.id] ?? 0,
        roleId,
        roleName,
      };
    });
    combinedCapabilities.push(...userCaps);
  }

  return combinedCapabilities;
}

export async function getLevelsForCapability(
  supabase: SupabaseClient,
  capabilityId: string,
): Promise<CapabilityLevel[]> {
  const { data, error } = await supabase
    .from("levels")
    .select(
      "id, level_code, title, description, example_outputs, duration_minutes, difficulty_level, status, total_xp",
    )
    .eq("capability_id", capabilityId)
    .eq("is_active", true)
    .eq("status", "published");

  if (error) {
    throw new Error(`Failed to fetch capability levels: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      let deliverables: string[] = [];
      if (Array.isArray(row.example_outputs)) {
        deliverables = row.example_outputs;
      } else if (typeof row.example_outputs === "string") {
        try {
          deliverables = JSON.parse(row.example_outputs);
        } catch {
          deliverables = [row.example_outputs];
        }
      }

      const levelCodeMatch = row.level_code.match(/L(\d+)/i);
      if (!levelCodeMatch) {
        apiLogger.warn(`Unrecognized level_code format: ${row.level_code}`, { capabilityId });
      }
      const parsedLevelNo = parseInt(levelCodeMatch?.[1] ?? "1", 10);

      return {
        id: row.id,
        levelNumber: parsedLevelNo,
        code: row.level_code,
        title: row.title,
        description: row.description,
        deliverables,
        durationMinutes: row.duration_minutes ?? 0,
        difficulty: row.difficulty_level ?? "intermediate",
        status: row.status,
        totalXp: (row as { total_xp?: number }).total_xp ?? 0,
      };
    })
    .sort((a, b) => a.levelNumber - b.levelNumber);
}
