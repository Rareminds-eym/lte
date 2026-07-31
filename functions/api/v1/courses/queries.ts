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
  ModuleDetailsResponse,
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
): Promise<LevelDetailsResponse | null> {
  const { data, error } = await supabase
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
      capabilities (
        code,
        name
      ),
      modules (
        id,
        module_no,
        title,
        description,
        is_published,
        is_active,
        modules_content (
          id,
          module_artifacts (
            artifact_type,
            is_active
          )
        )
      )
    `)
    .eq("id", levelId)
    .eq("is_active", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch level: ${error.message}`);
  }

  const rawLevel = data as LevelRow;
  const capData = Array.isArray(rawLevel.capabilities)
    ? rawLevel.capabilities[0]
    : rawLevel.capabilities;

  const moduleSummaries: LevelModuleSummary[] = (rawLevel.modules || [])
    .filter((m) => m.is_active === true)
    .sort((a, b) => a.module_no - b.module_no)
    .map((m) => ({
      id: m.id,
      moduleNo: m.module_no,
      title: m.title,
      description: m.description,
      isPublished: m.is_published,
    }));

  // Count all active artifacts (practice + final) across all active modules
  const artifactsCount = (rawLevel.modules || [])
    .filter((m) => m.is_active === true)
    .flatMap((m) => m.modules_content || [])
    .flatMap((mc) => mc.module_artifacts || [])
    .filter((a) => a.is_active === true)
    .length;

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
): Promise<ModuleDetailsResponse | null> {
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
      learning_content,
      modules_content (
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
      )
    `)
    .eq("level_id", levelData.id)
    .eq("module_no", moduleNo)
    .eq("is_active", true)
    .single();

  if (moduleError || !moduleData) {
    return null;
  }

  const rawModule = moduleData as unknown as ModuleRow;

  const ALL_STAGES: Lte6eStage[] = ["engage", "explore", "explain", "express", "empower", "evolve"];

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
  };
}
