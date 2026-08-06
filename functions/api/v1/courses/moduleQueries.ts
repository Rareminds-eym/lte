import { LTE_STAGE_SEQUENCE, normalizeStageName } from "@functions/lib/stage-sequence";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getArtifactTypeByStage,
  getSubmittedFilesByArtifactId,
  mapArtifactRow,
  pickArtifactType,
} from "./artifact-helpers";
import type {
  EContentItem,
  ModuleArtifact,
  ModuleContentRow,
  ModuleRow,
  ModuleStageContent,
} from "./types";

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
  // Fetch the active level
  const { data: levelData, error: levelError } = await supabase
    .from("levels")
    .select("id, level_code, title")
    .eq("id", levelId)
    .eq("is_active", true)
    .single();

  if (levelError || !levelData) {
    return null;
  }

  // Fetch module data
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

  const ALL_STAGES = [...LTE_STAGE_SEQUENCE];
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

  // Fetch module content with stages and artifacts
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
          instructions,
          response_type,
          allowed_file_types,
          max_file_size_mb,
          response_required
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

  const artifactTypeByStage = await getArtifactTypeByStage(supabase, rawModule.id, ALL_STAGES);

  rawModule.modules_content = modulesContentData as unknown as ModuleContentRow[];
  const artifactIds = (rawModule.modules_content || [])
    .flatMap((mc) => mc.module_artifacts || [])
    .filter((artifact) => artifact.is_active)
    .map((artifact) => artifact.id);
  const submittedFilesByArtifactId = await getSubmittedFilesByArtifactId(
    supabase,
    userId,
    artifactIds,
  );

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
        .map((art) => mapArtifactRow(art, submittedFilesByArtifactId));
      const artifactType = artifacts.reduce<"practice" | "final" | null>(
        (current, artifact) => pickArtifactType(current, artifact.artifactType),
        artifactTypeByStage.get(mc.stage_name) ?? null,
      );

      rawStagesMap.set(mc.stage_name, {
        id: mc.id,
        stageName: mc.stage_name,
        stageOrder: mc.stage_order,
        stageDescription: mc.stage_description || "",
        items,
        artifacts,
        artifactType,
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
      artifactType: artifactTypeByStage.get(stageName) ?? null,
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
