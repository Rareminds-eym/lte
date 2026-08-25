import {
  asQueryGateway,
  QueryGatewayDatabaseError,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import { normalizeStageName } from "@functions/lib/stage-sequence";
import { normalizeLevelProblemStatement } from "./queriesHelpers";
import type { LevelDetailsResponse, LevelModuleSummary, LevelRow } from "./types";

const activeModulesForLevelReadPolicy = {
  table: "modules",
  operation: "read",
  select: `
      id,
      module_no,
      title,
      description,
      is_published,
      is_active,
      module_problem_statement,
      pressure_points,
      user_confusion,
      industry_challenge,
      prerequisites,
      what_youll_learn,
      when_to_apply
    `,
  filters: ["level_id", "is_active"],
  sorts: ["module_no"],
  defaultFilters: [{ column: "is_active", op: "eq", value: true }],
} as const;

const userLevelProgressReadPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  columns: ["id"],
  filters: ["user_id", "level_id"],
  ownership: {
    column: "user_id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

const userModuleProgressReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["id", "module_id", "completion_percentage", "module_status"],
  filters: ["user_id", "user_capability_level_progress_id"],
  ownership: {
    column: "user_id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

const completedStagesReadPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["stage_name"],
  filters: ["user_module_progress_id", "status"],
} as const;

const modulesContentIdsReadPolicy = {
  table: "modules_content",
  operation: "read",
  columns: ["id"],
  filters: ["module_id"],
} as const;

const activeArtifactsReadPolicy = {
  table: "module_artifacts",
  operation: "read",
  columns: ["id"],
  filters: ["modules_content_id", "is_active"],
  defaultFilters: [{ column: "is_active", op: "eq", value: true }],
} as const;

const activeLevelDetailsReadPolicy = {
  table: "levels",
  operation: "read",
  columns: [
    "id",
    "level_code",
    "title",
    "description",
    "problem_statement",
    "observable_behavior",
    "example_outputs",
    "duration_minutes",
    "difficulty_level",
    "status",
    "version_no",
    "capability_id",
    "level_id",
  ],
  filters: ["id", "is_active"],
  defaultFilters: [{ column: "is_active", op: "eq", value: true }],
} as const;

const capabilitySummaryReadPolicy = {
  table: "capabilities",
  operation: "read",
  columns: ["code", "name", "slug"],
  filters: ["id"],
} as const;

export async function getLevelWithModules(
  source: QueryGatewaySource,
  levelId: string,
  userId?: string,
  includeStages: boolean = true,
): Promise<LevelDetailsResponse | null> {
  const qb = asQueryGateway(source);
  // Fetch level details
  let levelData:
    | (Omit<LevelRow, "modules" | "capabilities"> & { capability_id: string | null })
    | null;
  try {
    levelData = (await qb.read(activeLevelDetailsReadPolicy, {
      filters: [{ column: "id", op: "eq", value: levelId }],
      result: "maybeSingle",
    })) as (Omit<LevelRow, "modules" | "capabilities"> & { capability_id: string | null }) | null;
  } catch (error) {
    if (error instanceof QueryGatewayDatabaseError) {
      const cause = error.cause as { code?: string; message?: string } | undefined;
      if (cause?.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch level: ${cause?.message ?? error.message}`);
    }
    throw error;
  }

  if (!levelData) {
    return null;
  }

  // Fetch capability details
  const capData = levelData.capability_id
    ? ((await qb.read(capabilitySummaryReadPolicy, {
        filters: [{ column: "id", op: "eq", value: levelData.capability_id }],
        result: "maybeSingle",
      })) as { code: string; name: string; slug: string | null } | null)
    : null;

  // Fetch modules for this level
  let modulesData: LevelRow["modules"] | null;
  try {
    modulesData = (await qb.read(activeModulesForLevelReadPolicy, {
      filters: [{ column: "level_id", op: "eq", value: levelId }],
      sort: [{ column: "module_no", ascending: true }],
    })) as LevelRow["modules"] | null;
  } catch (error) {
    if (error instanceof QueryGatewayDatabaseError) {
      const causeMessage =
        error.cause && typeof error.cause === "object" && "message" in error.cause
          ? String(error.cause.message)
          : error.message;
      throw new Error(`Failed to fetch modules: ${causeMessage}`);
    }
    throw error;
  }

  const rawLevel = {
    ...levelData,
    capabilities: capData,
    modules: modulesData || [],
  } as LevelRow;

  const moduleProgressMap: Record<
    string,
    { completionPercentage: number; isCompleted: boolean; completedStages: string[] }
  > = {};

  if (userId) {
    const levelProgress = await qb.read(userLevelProgressReadPolicy, {
      auth: { userId },
      filters: [{ column: "level_id", op: "eq", value: levelId }],
      result: "maybeSingle",
    });

    if (levelProgress) {
      const progresses = (await qb.read(userModuleProgressReadPolicy, {
        auth: { userId },
        filters: [
          {
            column: "user_capability_level_progress_id",
            op: "eq",
            value: (levelProgress as { id: string }).id,
          },
        ],
      })) as Array<{
        id: string;
        module_id: string;
        completion_percentage: number | null;
        module_status: string | null;
      }> | null;

      if (progresses) {
        for (const p of progresses) {
          const entry = {
            completionPercentage: p.completion_percentage || 0,
            isCompleted: p.module_status === "completed" || p.module_status === "mastered",
            completedStages: [] as string[],
          };
          moduleProgressMap[p.module_id] = entry;

          if (!includeStages) continue;

          const stages = (await qb.read(completedStagesReadPolicy, {
            filters: [
              { column: "user_module_progress_id", op: "eq", value: p.id },
              { column: "status", op: "eq", value: "completed" },
            ],
          })) as Array<{ stage_name: string }> | null;

          if (stages) {
            entry.completedStages = stages.map((s) => normalizeStageName(s.stage_name));
          }
        }
      }
    }
  }

  const moduleSummaries: LevelModuleSummary[] = (rawLevel.modules || [])
    .filter((m) => m.is_active === true)
    .sort((a, b) => a.module_no - b.module_no)
    .map((m) => {
      const prog = moduleProgressMap[m.id];
      return {
        id: m.id,
        moduleNo: m.module_no,
        title: m.title,
        description: m.description,
        isPublished: m.is_published,
        progressPercentage: prog ? prog.completionPercentage : 0,
        isCompleted: prog ? prog.isCompleted : false,
        completedStages: prog ? prog.completedStages : [],
        module_problem_statement: m.module_problem_statement,
        pressure_points: m.pressure_points,
        user_confusion: m.user_confusion,
        industry_challenge: m.industry_challenge ?? null,
        prerequisites: m.prerequisites,
        what_youll_learn: m.what_youll_learn,
        when_to_apply: m.when_to_apply,
      };
    });

  let artifactsCount = 0;
  if (moduleSummaries.length > 0) {
    const modulesContent = (await qb.read(modulesContentIdsReadPolicy, {
      filters: [{ column: "module_id", op: "in", value: moduleSummaries.map((m) => m.id) }],
    })) as Array<{ id: string }> | null;

    if (modulesContent && modulesContent.length > 0) {
      const artifacts = (await qb.read(activeArtifactsReadPolicy, {
        filters: [
          { column: "modules_content_id", op: "in", value: modulesContent.map((mc) => mc.id) },
        ],
      })) as Array<{ id: string }> | null;

      artifactsCount = artifacts?.length ?? 0;
    }
  }

  return {
    id: rawLevel.id,
    levelCode: rawLevel.level_code,
    capabilityCode: capData?.code,
    capabilityName: capData?.name,
    capabilitySlug: capData?.slug ?? undefined,
    levelNo: 1,
    levelLabel: rawLevel.difficulty_level,
    title: rawLevel.title,
    description: rawLevel.description,
    levelProblemStatement: normalizeLevelProblemStatement(
      rawLevel.problem_statement,
      rawLevel.title,
      rawLevel.description,
    ),
    observableBehavior: rawLevel.observable_behavior,
    exampleOutputs: rawLevel.example_outputs,
    durationMinutes: rawLevel.duration_minutes,
    difficultyLevel: rawLevel.difficulty_level,
    levelStatus: rawLevel.status,
    versionNo: rawLevel.version_no,
    artifactsCount,
    modules: moduleSummaries,
  };
}
