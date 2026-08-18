import {
  asQueryGateway,
  QueryGatewayDatabaseError,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import { apiLogger } from "@functions/shared/logger";
import type {
  Capability,
  CapabilityLevel,
  RoleCapabilitySequenceRow,
  UserCapability,
} from "./types";

const roleCapabilitiesReadPolicy = {
  table: "role_capability_sequence",
  operation: "read",
  select: `
      id,
      sequence_step,
      required_level,
      capability_priority,
      capabilities (
        id,
        code,
        name,
        description,
        slug
      )
    `,
  filters: ["role_id"],
  sorts: ["sequence_step"],
} as const;

const levelStatsReadPolicy = {
  table: "levels",
  operation: "read",
  columns: ["capability_id", "id", "total_xp", "duration_minutes"],
  filters: ["capability_id", "is_active", "status"],
  defaultFilters: [
    { column: "is_active", op: "eq", value: true },
    { column: "status", op: "eq", value: "published" },
  ],
} as const;

const capabilityProgressLevelsReadPolicy = {
  table: "levels",
  operation: "read",
  columns: ["id", "capability_id", "level_code"],
  filters: ["capability_id", "is_active", "status"],
  defaultFilters: [
    { column: "is_active", op: "eq", value: true },
    { column: "status", op: "eq", value: "published" },
  ],
} as const;

const modulesByLevelReadPolicy = {
  table: "modules",
  operation: "read",
  columns: ["id", "level_id"],
  filters: ["level_id", "is_active"],
  defaultFilters: [{ column: "is_active", op: "eq", value: true }],
} as const;

const userModuleProgressReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["module_id", "module_status", "completion_percentage"],
  filters: ["user_id", "module_id"],
  ownership: {
    column: "user_id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

const levelsForCapabilityReadPolicy = {
  table: "levels",
  operation: "read",
  columns: [
    "id",
    "level_code",
    "title",
    "description",
    "example_outputs",
    "duration_minutes",
    "difficulty_level",
    "status",
    "total_xp",
  ],
  filters: ["capability_id", "is_active", "status"],
  defaultFilters: [
    { column: "is_active", op: "eq", value: true },
    { column: "status", op: "eq", value: "published" },
  ],
} as const;

function rethrowQueryError(error: unknown, message: string): never {
  if (error instanceof QueryGatewayDatabaseError) {
    const causeMessage =
      error.cause && typeof error.cause === "object" && "message" in error.cause
        ? String(error.cause.message)
        : error.message;
    throw new Error(`${message}: ${causeMessage}`);
  }
  throw error;
}

export async function getCapabilitiesByRoleId(
  source: QueryGatewaySource,
  roleId: string,
): Promise<Capability[]> {
  const qb = asQueryGateway(source);
  let data: RoleCapabilitySequenceRow[] | null;
  try {
    data = (await qb.read(roleCapabilitiesReadPolicy, {
      filters: [{ column: "role_id", op: "eq", value: roleId }],
      sort: [{ column: "sequence_step", ascending: true }],
    })) as RoleCapabilitySequenceRow[] | null;
  } catch (error) {
    rethrowQueryError(error, "Failed to fetch role capabilities");
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
      slug: cap?.slug ?? undefined,
      level: item.required_level ?? undefined,
      priority: item.capability_priority ?? undefined,
      step: item.sequence_step ?? undefined,
    };
  });
}

export async function getLevelStatsForCapabilities(
  source: QueryGatewaySource,
  capabilityIds: string[],
): Promise<{
  counts: Record<string, number>;
  xpSums: Record<string, number>;
  durationHours: Record<string, number>;
}> {
  if (capabilityIds.length === 0) return { counts: {}, xpSums: {}, durationHours: {} };

  const qb = asQueryGateway(source);
  let data: Array<{
    capability_id: string;
    id: string;
    total_xp?: number;
    duration_minutes?: number | null;
  }> | null;
  try {
    data = (await qb.read(levelStatsReadPolicy, {
      filters: [{ column: "capability_id", op: "in", value: capabilityIds }],
    })) as Array<{
      capability_id: string;
      id: string;
      total_xp?: number;
      duration_minutes?: number | null;
    }> | null;
  } catch (error) {
    rethrowQueryError(error, "Failed to fetch level counts");
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
  source: QueryGatewaySource,
  userId: string,
  capabilityIds: string[],
): Promise<Record<string, CapabilityProgressSummary>> {
  if (capabilityIds.length === 0) return {};

  const qb = asQueryGateway(source);
  let levels: Array<{
    id: string;
    capability_id: string;
    level_code: string;
  }> | null;
  try {
    levels = (await qb.read(capabilityProgressLevelsReadPolicy, {
      filters: [{ column: "capability_id", op: "in", value: capabilityIds }],
    })) as Array<{
      id: string;
      capability_id: string;
      level_code: string;
    }> | null;
  } catch (error) {
    rethrowQueryError(error, "Failed to fetch capability progress levels");
  }

  const levelRows = (levels ?? []) as Array<{
    id: string;
    capability_id: string;
    level_code: string;
  }>;
  const levelIds = levelRows.map((level) => level.id);
  if (levelIds.length === 0) return {};

  let moduleRows: Array<{ id: string; level_id: string }> | null;
  try {
    moduleRows = (await qb.read(modulesByLevelReadPolicy, {
      filters: [{ column: "level_id", op: "in", value: levelIds }],
    })) as Array<{ id: string; level_id: string }> | null;
  } catch (error) {
    rethrowQueryError(error, "Failed to fetch capability progress modules");
  }

  const modules = (moduleRows ?? []) as Array<{ id: string; level_id: string }>;
  const moduleIds = modules.map((module) => module.id);
  const moduleLevelById = new Map(modules.map((module) => [module.id, module.level_id]));
  const moduleCountByLevel = modules.reduce<Record<string, number>>((counts, module) => {
    counts[module.level_id] = (counts[module.level_id] ?? 0) + 1;
    return counts;
  }, {});

  let moduleProgressRows: Array<{
    module_id: string;
    module_status: string;
    completion_percentage: number | null;
  }> = [];
  if (moduleIds.length) {
    try {
      moduleProgressRows = ((await qb.read(userModuleProgressReadPolicy, {
        auth: { userId },
        filters: [{ column: "module_id", op: "in", value: moduleIds }],
      })) ?? []) as Array<{
        module_id: string;
        module_status: string;
        completion_percentage: number | null;
      }>;
    } catch (error) {
      rethrowQueryError(error, "Failed to fetch user module progress");
    }
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
  source: QueryGatewaySource,
  userId: string,
  roleIds: string[],
  rolesInfo: Array<{ roleId: string; roleName: string }>,
): Promise<UserCapability[]> {
  if (roleIds.length === 0) return [];

  const combinedCapabilities: UserCapability[] = [];
  const roleNameMap = new Map<string, string>(rolesInfo.map((r) => [r.roleId, r.roleName]));

  for (const roleId of roleIds) {
    const capabilities = await getCapabilitiesByRoleId(source, roleId);
    if (capabilities.length === 0) continue;

    const capIds = capabilities.map((c) => c.id);
    const {
      counts: levelCounts,
      xpSums,
      durationHours,
    } = await getLevelStatsForCapabilities(source, capIds);
    const progressSummaries = await getUserCapabilityProgressSummaries(source, userId, capIds);
    const roleName = roleNameMap.get(roleId) ?? "";

    const userCaps = capabilities.map((cap) => {
      const progressSummary = progressSummaries[cap.id];

      return {
        id: cap.id,
        name: cap.name,
        description: cap.description,
        code: cap.code,
        slug: cap.slug,
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
  source: QueryGatewaySource,
  capabilityId: string,
): Promise<CapabilityLevel[]> {
  const qb = asQueryGateway(source);
  let data: Array<{
    id: string;
    level_code: string;
    title: string;
    description: string;
    example_outputs: unknown;
    duration_minutes: number | null;
    difficulty_level: string | null;
    status: string;
    total_xp?: number;
  }> | null;
  try {
    data = (await qb.read(levelsForCapabilityReadPolicy, {
      filters: [{ column: "capability_id", op: "eq", value: capabilityId }],
    })) as Array<{
      id: string;
      level_code: string;
      title: string;
      description: string;
      example_outputs: unknown;
      duration_minutes: number | null;
      difficulty_level: string | null;
      status: string;
      total_xp?: number;
    }> | null;
  } catch (error) {
    rethrowQueryError(error, "Failed to fetch capability levels");
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
