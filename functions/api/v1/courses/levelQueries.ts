import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLevelProblemStatement } from "./queriesHelpers";
import type { LevelDetailsResponse, LevelModuleSummary, LevelRow } from "./types";

export async function getLevelWithModules(
  supabase: SupabaseClient,
  levelId: string,
  userId?: string,
  includeStages: boolean = true,
): Promise<LevelDetailsResponse | null> {
  // Fetch level details
  const { data: levelData, error: levelError } = await supabase
    .from("levels")
    .select(`
      id,
      level_code,
      title,
      description,
      problem_statement,
      observable_behavior,
      example_outputs,
      duration_minutes,
      difficulty_level,
      status,
      version_no,
      capability_id,
      level_id
    `)
    .eq("id", levelId)
    .eq("is_active", true)
    .single();

  if (levelError) {
    if (levelError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch level: ${levelError.message}`);
  }

  if (!levelData) {
    return null;
  }

  // Fetch capability details
  const { data: capData } = levelData.capability_id
    ? await supabase
        .from("capabilities")
        .select("code, name")
        .eq("id", levelData.capability_id)
        .single()
    : { data: null };

  // Fetch modules for this level
  const { data: modulesData, error: modulesError } = await supabase
    .from("modules")
    .select(`
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
    `)
    .eq("level_id", levelId)
    .eq("is_active", true)
    .order("module_no", { ascending: true });

  if (modulesError) {
    throw new Error(`Failed to fetch modules: ${modulesError.message}`);
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
    const { data: levelProgress } = await supabase
      .from("user_capability_level_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("level_id", levelId)
      .maybeSingle();

    if (levelProgress) {
      const { data: progresses } = await supabase
        .from("user_module_progress")
        .select("id, module_id, completion_percentage, module_status")
        .eq("user_id", userId)
        .eq("user_capability_level_progress_id", levelProgress.id);

      if (progresses) {
        for (const p of progresses) {
          const entry = {
            completionPercentage: p.completion_percentage || 0,
            isCompleted: p.module_status === "completed" || p.module_status === "mastered",
            completedStages: [] as string[],
          };
          moduleProgressMap[p.module_id] = entry;

          if (!includeStages) continue;

          const { data: stages } = await supabase
            .from("user_stage_progress")
            .select("stage_name")
            .eq("user_module_progress_id", p.id)
            .eq("status", "completed");

          if (stages) {
            entry.completedStages = stages.map((s) => s.stage_name.toLowerCase());
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
    const { data: modulesContent } = await supabase
      .from("modules_content")
      .select("id")
      .in(
        "module_id",
        moduleSummaries.map((m) => m.id),
      );

    if (modulesContent && modulesContent.length > 0) {
      const { data: artifacts } = await supabase
        .from("module_artifacts")
        .select("id")
        .in(
          "modules_content_id",
          modulesContent.map((mc) => mc.id),
        )
        .eq("is_active", true);

      artifactsCount = artifacts?.length ?? 0;
    }
  }

  return {
    id: rawLevel.id,
    levelCode: rawLevel.level_code,
    capabilityCode: capData?.code,
    capabilityName: capData?.name,
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
