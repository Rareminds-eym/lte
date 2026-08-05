import {
  assertStageSequenceAllowed,
  getStageCompletionPercentage,
  getStageOrder,
  LTE_STAGE_COUNT,
  LTE_STAGE_SEQUENCE,
  normalizeStageName,
} from "@functions/lib/stage-sequence";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EContentItem,
  LevelDetailsResponse,
  LevelModuleSummary,
  LevelProblemStatement,
  LevelRow,
  Lte6eStage,
  ModuleArtifact,
  ModuleArtifactQuestion,
  ModuleContentRow,
  ModuleRow,
  ModuleStageContent,
} from "./types";

const normalizeLevelProblemStatement = (
  value: unknown,
  fallbackTitle: string,
  fallbackDescription: string,
): LevelProblemStatement => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as { title?: unknown; description?: unknown };
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const description = typeof record.description === "string" ? record.description.trim() : "";

    return {
      title: title || fallbackTitle,
      description: description || fallbackDescription,
    };
  }

  return {
    title: fallbackTitle,
    description: fallbackDescription,
  };
};

/**
 * Fetch level details and summary of its modules.
 */
export async function getLevelWithModules(
  supabase: SupabaseClient,
  levelId: string,
  userId?: string,
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
            isCompleted: p.module_status === "completed",
            completedStages: [] as string[],
          };
          moduleProgressMap[p.module_id] = entry;

          const { data: stages } = await supabase
            .from("user_stage_progress")
            .select("stage_name")
            .eq("user_module_progress_id", p.id)
            .eq("status", "completed");

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
        industry_challenge: m.industry_challenge,
        prerequisites: m.prerequisites,
        what_youll_learn: m.what_youll_learn,
        when_to_apply: m.when_to_apply,
      };
    });

  let artifactsCount = 0;
  if (moduleSummaries.length > 0) {
    // Get all modules_content IDs for this level's modules
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

/**
 * Fetch a specific module with all its 6E stages, e_content items, and artifacts
 */
export async function getModuleDetails(
  supabase: SupabaseClient,
  levelId: string,
  moduleNo: number,
  userId?: string,
): Promise<{
  id: string;
  levelId: string;
  levelCode: string;
  levelTitle: string;
  moduleNo: number;
  title: string;
  description: string;
  moduleProblemStatement: unknown;
  pressurePoints: unknown;
  userConfusion: unknown;
  industryChallenge: unknown;
  prerequisites: unknown;
  whatYoullLearn: unknown;
  whenToApply: unknown;
  support: Record<string, unknown>;
  knowledge: Record<string, unknown>;
  tools: Record<string, unknown>;
  learningContent: Record<string, unknown>;
  stages: ModuleStageContent[];
  progressPercentage: number;
  completedStages: string[];
} | null> {
  // First locate the active level so the module query can use modules.level_id.
  const { data: levelData, error: levelError } = await supabase
    .from("levels")
    .select("id, level_code, title")
    .eq("id", levelId)
    .eq("is_active", true)
    .single();

  if (levelError || !levelData) {
    return null;
  }

  const { data: moduleData, error: moduleError } = await supabase
    .from("modules")
    .select(`
      id,
      level_id,
      module_no,
      title,
      description,
      module_problem_statement,
      pressure_points,
      user_confusion,
      industry_challenge,
      prerequisites,
      what_youll_learn,
      when_to_apply,
      support,
      knowledge,
      tools,
      learning_content
    `)
    .eq("level_id", levelData.id)
    .eq("module_no", moduleNo)
    .eq("is_active", true)
    .single();

  if (moduleError || !moduleData) {
    return null;
  }

  const rawModule = moduleData as unknown as ModuleRow;

  const ALL_STAGES: Lte6eStage[] = [...LTE_STAGE_SEQUENCE];
  let completedStages: string[] = [];
  let progressPercentage = 0;

  if (userId) {
    const { data: moduleProgress } = await supabase
      .from("user_module_progress")
      .select("id, completion_percentage")
      .eq("user_id", userId)
      .eq("module_id", rawModule.id)
      .maybeSingle();

    if (moduleProgress) {
      progressPercentage = moduleProgress.completion_percentage || 0;

      const { data: stagesProg } = await supabase
        .from("user_stage_progress")
        .select("stage_name")
        .eq("user_module_progress_id", moduleProgress.id)
        .eq("status", "completed");

      if (stagesProg) {
        completedStages = stagesProg.map((s) => normalizeStageName(s.stage_name));
      }
    }
  }

  const completedStageSet = new Set(completedStages.map(normalizeStageName));
  const firstIncompleteStage = ALL_STAGES.find((stage) => !completedStageSet.has(stage));
  const allowedStages = firstIncompleteStage
    ? Array.from(completedStageSet).concat(firstIncompleteStage)
    : ALL_STAGES;

  const { data: modulesContentData, error: modulesContentError } = await supabase
    .from("modules_content")
    .select(`
      id,
      stage_name,
      stage_order,
      stage_description,
      is_active,
      e_content (
        id,
        content_type,
        title,
        description,
        url,
        sort_order,
        duration_seconds,
        xp_reward,
        mime_type,
        file_size_bytes,
        status
      ),
      module_artifacts (
        id,
        artifact_type,
        total_score,
        passing_score,
        is_active,
        artifact_questions (
          id,
          question_order,
          title,
          description,
          instructions
        ),
        artifact_templates (
          id,
          question_id,
          file_name,
          file_url,
          file_type,
          version,
          is_downloadable
        )
      )
    `)
    .eq("module_id", rawModule.id)
    .eq("is_active", true)
    .in("stage_name", allowedStages);

  if (modulesContentError) {
    throw new Error(`Failed to fetch module stage content: ${modulesContentError.message}`);
  }

  rawModule.modules_content = modulesContentData as unknown as ModuleContentRow[];

  const rawStagesMap = new Map<string, ModuleStageContent>();

  (rawModule.modules_content || [])
    .filter((mc) => mc.is_active === true)
    .forEach((mc) => {
      const items: EContentItem[] = (mc.e_content || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => ({
          id: item.id,
          contentType: item.content_type,
          title: item.title,
          description: item.description,
          url: item.url,
          sortOrder: item.sort_order,
          durationSeconds: item.duration_seconds,
          xpReward: item.xp_reward,
          mimeType: item.mime_type,
          fileSizeBytes: item.file_size_bytes,
          status: item.status,
        }));

      const artifacts: ModuleArtifact[] = (mc.module_artifacts || [])
        .filter((art) => art.is_active === true)
        .map((art) => {
          const questions: ModuleArtifactQuestion[] = (art.artifact_questions || [])
            .sort((a, b) => a.question_order - b.question_order)
            .map((q) => ({
              id: q.id,
              questionOrder: q.question_order,
              title: q.title,
              description: q.description,
              instructions: q.instructions,
            }));
          const templates = (art.artifact_templates || []).map((template) => ({
            id: template.id,
            questionId: template.question_id,
            fileName: template.file_name,
            fileUrl: template.file_url,
            fileType: template.file_type,
            version: template.version,
            isDownloadable: template.is_downloadable,
          }));

          return {
            id: art.id,
            artifactType: art.artifact_type,
            totalScore: art.total_score,
            passingScore: art.passing_score,
            questions,
            templates,
            isActive: art.is_active,
          };
        });

      rawStagesMap.set(mc.stage_name, {
        id: mc.id,
        stageName: mc.stage_name,
        stageOrder: mc.stage_order,
        stageDescription: mc.stage_description || "",
        items,
        artifacts,
        isActive: mc.is_active,
      });
    });

  // Ensure all 6 stages exist in output order 1..6
  const stages: ModuleStageContent[] = ALL_STAGES.map((stageName, index): ModuleStageContent => {
    const existing = rawStagesMap.get(stageName);
    if (existing) {
      return existing;
    }
    return {
      id: `virtual-${stageName}`,
      stageName,
      stageOrder: index + 1,
      stageDescription: "",
      items: [] as EContentItem[],
      artifacts: [] as ModuleArtifact[],
      isActive: false,
    };
  });

  return {
    id: rawModule.id,
    levelId: rawModule.level_id,
    levelCode: levelData.level_code,
    levelTitle: levelData.title,
    moduleNo: rawModule.module_no,
    title: rawModule.title,
    description: rawModule.description,
    moduleProblemStatement: rawModule.module_problem_statement,
    pressurePoints: rawModule.pressure_points,
    userConfusion: rawModule.user_confusion,
    industryChallenge: rawModule.industry_challenge,
    prerequisites: rawModule.prerequisites,
    whatYoullLearn: rawModule.what_youll_learn,
    whenToApply: rawModule.when_to_apply,
    support: rawModule.support || {},
    knowledge: rawModule.knowledge || {},
    tools: rawModule.tools || {},
    learningContent: rawModule.learning_content || {},
    stages,
    progressPercentage,
    completedStages,
  };
}

export async function upsertLevelProgress(
  supabase: SupabaseClient,
  userId: string,
  levelId: string,
  status: string = "in_progress",
): Promise<string> {
  // 1. Fetch level details to extract level number and capability
  const { data: levelData, error: levelError } = await supabase
    .from("levels")
    .select("id, level_code, capability_id")
    .eq("id", levelId)
    .single();

  if (levelError || !levelData) {
    throw new Error(`Level with id '${levelId}' not found: ${levelError?.message}`);
  }

  const levelCodeMatch = levelData.level_code.match(/L(\d+)/i);
  const sequenceNo = parseInt(levelCodeMatch?.[1] ?? "1", 10);
  const capabilityId = levelData.capability_id;

  // 2. Fetch active learning track
  const { data: trackData, error: trackError } = await supabase
    .from("learning_tracks")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (trackError) {
    throw new Error(`Failed to query active learning path: ${trackError.message}`);
  }
  if (!trackData) {
    throw new Error("No active learning path found for this user");
  }

  // 3. Fetch learning paths under active track
  const { data: pathsData, error: pathsError } = await supabase
    .from("learning_paths")
    .select("id, role_id")
    .eq("user_id", userId)
    .eq("learning_track_id", trackData.id);

  if (pathsError) {
    throw new Error(`Failed to query active learning path: ${pathsError.message}`);
  }
  if (!pathsData || pathsData.length === 0) {
    throw new Error("No active learning path found for this user");
  }

  // 4. Fetch role capability sequence to match the capability to the correct role
  const roleIds = pathsData.map((p) => p.role_id);
  const { data: seqRoleData, error: seqRoleError } = await supabase
    .from("role_capability_sequence")
    .select("role_id")
    .in("role_id", roleIds)
    .eq("capability_id", capabilityId);

  if (seqRoleError) {
    throw new Error(`Failed to query active learning path: ${seqRoleError.message}`);
  }

  const matchingRoleId = seqRoleData && seqRoleData.length > 0 ? seqRoleData[0]?.role_id : null;
  const activePath = pathsData.find((p) => p.role_id === matchingRoleId) ?? pathsData[0];

  if (!activePath) {
    throw new Error("No active learning path found for this user");
  }

  const learningPathId = activePath.id;
  const roleId = activePath.role_id;

  // 3. Check for existing progress
  const { data: existingProgress, error: fetchError } = await supabase
    .from("user_capability_level_progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("learning_path_id", learningPathId)
    .eq("level_id", levelId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to query level progress: ${fetchError.message}`);
  }

  if (existingProgress) {
    if (existingProgress.status === "not_started" && status === "in_progress") {
      const { error: updateError } = await supabase
        .from("user_capability_level_progress")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProgress.id);

      if (updateError) {
        throw new Error(`Failed to update level progress status: ${updateError.message}`);
      }
    }
    return existingProgress.id;
  }

  // 4. Fetch capability priority, current level, and required level for computations
  const { data: seqData, error: seqError } = await supabase
    .from("role_capability_sequence")
    .select("id, required_level, capability_priority")
    .eq("role_id", roleId)
    .eq("capability_id", capabilityId)
    .maybeSingle();

  let priorityBand = "none";
  let requiredLevelNum = 1;
  let currentLevelNum = 0;

  if (seqError) {
    throw new Error(`Failed to query role capability sequence: ${seqError.message}`);
  }

  if (seqData) {
    priorityBand = seqData.capability_priority ?? "none";
    const levelMap: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
    requiredLevelNum = levelMap[seqData.required_level as string] || 1;

    // fetch current capability level
    const { data: capData, error: capQueryError } = await supabase
      .from("user_capabilities")
      .select("current_level")
      .eq("user_id", userId)
      .eq("role_sequence_id", seqData.id)
      .maybeSingle();

    if (capQueryError) {
      throw new Error(`Failed to query user capabilities: ${capQueryError.message}`);
    }

    if (capData) {
      currentLevelNum = capData.current_level;
    } else {
      // Initialize new user capability since it is missing
      const { error: capInsertError } = await supabase.from("user_capabilities").insert({
        user_id: userId,
        learning_path_id: learningPathId,
        role_sequence_id: seqData.id,
        current_level: 0,
        required_level: requiredLevelNum,
        gap: requiredLevelNum,
        has_gap: requiredLevelNum > 0,
        gap_score: 0,
        badge: "none",
        updated_at: new Date().toISOString(),
      });

      if (capInsertError) {
        throw new Error(`Failed to insert user capability: ${capInsertError.message}`);
      }
      currentLevelNum = 0;
    }
  }

  const gap = Math.max(0, requiredLevelNum - currentLevelNum);
  const hasGap = gap > 0;
  const gapScore =
    requiredLevelNum > 0 ? Math.round((currentLevelNum / requiredLevelNum) * 100) : 0;

  // 5. Insert new level progress
  const { data: inserted, error: insertError } = await supabase
    .from("user_capability_level_progress")
    .insert({
      user_id: userId,
      learning_path_id: learningPathId,
      level_id: levelId,
      sequence_no: sequenceNo,
      from_level: Math.max(0, sequenceNo - 1),
      to_level: sequenceNo,
      current_score: 0,
      current_level: currentLevelNum,
      required_level: requiredLevelNum,
      gap,
      has_gap: hasGap,
      gap_score: gapScore,
      priority_band: priorityBand,
      status: status,
      badge: "none",
      completion_percentage: 0,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert level progress: ${insertError.message}`);
  }

  return inserted.id;
}

export async function upsertModuleProgress(
  supabase: SupabaseClient,
  userId: string,
  levelId: string,
  moduleNo: number,
  status: string = "in_progress",
): Promise<string> {
  // 1. Ensure level progress exists
  const levelProgressId = await upsertLevelProgress(supabase, userId, levelId, "in_progress");

  // 2. Fetch module_id
  const { data: moduleData, error: moduleError } = await supabase
    .from("modules")
    .select("id")
    .eq("level_id", levelId)
    .eq("module_no", moduleNo)
    .eq("is_active", true)
    .single();

  if (moduleError || !moduleData) {
    throw new Error(`Module ${moduleNo} for level '${levelId}' not found: ${moduleError?.message}`);
  }

  const moduleId = moduleData.id;

  // 3. Check for existing progress
  const { data: existingProgress, error: fetchError } = await supabase
    .from("user_module_progress")
    .select("id, module_status")
    .eq("user_id", userId)
    .eq("user_capability_level_progress_id", levelProgressId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to query module progress: ${fetchError.message}`);
  }

  if (existingProgress) {
    if (existingProgress.module_status === "not_started" && status === "in_progress") {
      const { error: updateError } = await supabase
        .from("user_module_progress")
        .update({
          module_status: "in_progress",
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProgress.id);

      if (updateError) {
        throw new Error(`Failed to update module progress status: ${updateError.message}`);
      }
    }
    return existingProgress.id;
  }

  // 4. Insert new module progress
  const { data: inserted, error: insertError } = await supabase
    .from("user_module_progress")
    .insert({
      user_id: userId,
      user_capability_level_progress_id: levelProgressId,
      module_id: moduleId,
      module_status: status,
      current_stage: "engage",
      stages_completed: 0,
      completion_percentage: 0,
      artifact_submitted: false,
      artifact_approval_status: "not_submitted",
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert module progress: ${insertError.message}`);
  }

  return inserted.id;
}

export async function upsertStageProgress(
  supabase: SupabaseClient,
  userId: string,
  levelId: string,
  moduleNo: number,
  eContentId: string,
  stageName: string,
  status: string = "in_progress",
): Promise<{ stageProgressId: string; stagesCompleted: number; completionPercentage: number }> {
  // 1. Ensure module progress exists
  const moduleProgressId = await upsertModuleProgress(
    supabase,
    userId,
    levelId,
    moduleNo,
    "in_progress",
  );

  // 2. Validate stage name and get stage order
  const normalizedStageName = normalizeStageName(stageName);
  const stageOrder = getStageOrder(normalizedStageName);
  if (!stageOrder) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }

  const { data: existingCompletedStages, error: completedStagesError } = await supabase
    .from("user_stage_progress")
    .select("stage_name")
    .eq("user_module_progress_id", moduleProgressId)
    .eq("user_id", userId)
    .eq("status", "completed");

  if (completedStagesError) {
    throw new Error(`Failed to validate stage sequence: ${completedStagesError.message}`);
  }

  assertStageSequenceAllowed(
    normalizedStageName,
    existingCompletedStages?.map((stage) => stage.stage_name) ?? [],
  );

  // 3. Upsert stage progress
  const { data: existingProgress } = await supabase
    .from("user_stage_progress")
    .select("id, status")
    .eq("user_module_progress_id", moduleProgressId)
    .eq("user_id", userId)
    .eq("e_content_id", eContentId)
    .eq("stage_name", normalizedStageName)
    .maybeSingle();

  let stageProgressId = "";

  if (existingProgress) {
    stageProgressId = existingProgress.id;
    // Only transition status if moving to completed
    if (existingProgress.status !== "completed" && status === "completed") {
      const { error: updateError } = await supabase
        .from("user_stage_progress")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProgress.id);

      if (updateError) {
        throw new Error(`Failed to update stage progress to completed: ${updateError.message}`);
      }
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("user_stage_progress")
      .insert({
        user_module_progress_id: moduleProgressId,
        user_id: userId,
        e_content_id: eContentId,
        stage_name: normalizedStageName,
        stage_order: stageOrder,
        status: status,
        started_at: new Date().toISOString(),
        completed_at: status === "completed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to insert stage progress: ${insertError.message}`);
    }
    stageProgressId = inserted.id;
  }

  // 4. Recalculate module progress completion stats
  const { data: completedItems, error: completedError } = await supabase
    .from("user_stage_progress")
    .select("stage_name")
    .eq("user_module_progress_id", moduleProgressId)
    .eq("status", "completed");

  if (completedError) {
    throw new Error(
      `Failed to fetch completed stages for module recalculation: ${completedError.message}`,
    );
  }

  const completedStagesSet = new Set(
    completedItems?.map((item) => normalizeStageName(item.stage_name)) ?? [],
  );
  const stagesCompleted = completedStagesSet.size;
  const completionPercentage = getStageCompletionPercentage(stagesCompleted);

  // 5. Update user_module_progress
  const { error: modUpdateError } = await supabase
    .from("user_module_progress")
    .update({
      current_stage: normalizedStageName,
      stages_completed: stagesCompleted,
      completion_percentage: completionPercentage,
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", moduleProgressId);

  if (modUpdateError) {
    throw new Error(`Failed to update module progress stats: ${modUpdateError.message}`);
  }

  // 6. If all stages completed, set module status to completed
  if (stagesCompleted === LTE_STAGE_COUNT) {
    const { error: finalModError } = await supabase
      .from("user_module_progress")
      .update({
        module_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", moduleProgressId);

    if (finalModError) {
      throw new Error(`Failed to finalize module status to completed: ${finalModError.message}`);
    }
  }

  return {
    stageProgressId,
    stagesCompleted,
    completionPercentage,
  };
}
