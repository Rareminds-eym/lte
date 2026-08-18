import {
  asQueryGateway,
  QueryGatewayDatabaseError,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import { LTE_STAGE_SEQUENCE, normalizeStageName } from "@functions/lib/stage-sequence";
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

const moduleProgressReadPolicy = {
  table: "user_module_progress",
  operation: "read",
  columns: ["id", "completion_percentage"],
  filters: ["user_id", "module_id"],
  ownership: {
    column: "user_id",
    source: "authenticatedUserId",
    required: true,
  },
} as const;

const completedStageProgressReadPolicy = {
  table: "user_stage_progress",
  operation: "read",
  columns: ["stage_name"],
  filters: ["user_module_progress_id", "status"],
} as const;

const moduleStageContentReadPolicy = {
  table: "modules_content",
  operation: "read",
  select: `
      id,
      stage_name,
      stage_order,
      stage_description,
      module_context,
      curriculum_reference,
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
    `,
  filters: ["module_id", "is_active", "stage_name"],
  defaultFilters: [{ column: "is_active", op: "eq", value: true }],
} as const;

const activeLevelSummaryReadPolicy = {
  table: "levels",
  operation: "read",
  columns: ["id", "level_code", "title"],
  filters: ["id", "is_active"],
  defaultFilters: [{ column: "is_active", op: "eq", value: true }],
} as const;

const activeModuleDetailsReadPolicy = {
  table: "modules",
  operation: "read",
  columns: [
    "id",
    "level_id",
    "module_no",
    "title",
    "description",
    "module_problem_statement",
    "pressure_points",
    "user_confusion",
    "industry_challenge",
    "prerequisites",
    "what_youll_learn",
    "when_to_apply",
    "support",
    "knowledge",
    "tools",
    "learning_content",
  ],
  filters: ["level_id", "module_no", "is_active"],
  defaultFilters: [{ column: "is_active", op: "eq", value: true }],
} as const;

export async function getModuleDetails(
  source: QueryGatewaySource,
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
  const qb = asQueryGateway(source);
  // Fetch the active level
  let levelData: { id: string; level_code: string; title: string } | null;
  try {
    levelData = (await qb.read(activeLevelSummaryReadPolicy, {
      filters: [{ column: "id", op: "eq", value: levelId }],
      result: "maybeSingle",
    })) as { id: string; level_code: string; title: string } | null;
  } catch (error) {
    if (error instanceof QueryGatewayDatabaseError) {
      return null;
    }
    throw error;
  }

  if (!levelData) {
    return null;
  }

  // Fetch module data
  let moduleData: unknown;
  try {
    moduleData = await qb.read(activeModuleDetailsReadPolicy, {
      filters: [
        { column: "level_id", op: "eq", value: levelData.id },
        { column: "module_no", op: "eq", value: moduleNo },
      ],
      result: "maybeSingle",
    });
  } catch (error) {
    if (error instanceof QueryGatewayDatabaseError) {
      return null;
    }
    throw error;
  }

  if (!moduleData) {
    return null;
  }

  const rawModule = moduleData as unknown as ModuleRow;

  const ALL_STAGES = [...LTE_STAGE_SEQUENCE];
  let completedStages: string[] = [];
  let progressPercentage = 0;

  if (userId) {
    const moduleProgress = (await qb.read(moduleProgressReadPolicy, {
      auth: { userId },
      filters: [{ column: "module_id", op: "eq", value: rawModule.id }],
      result: "maybeSingle",
    })) as { id: string; completion_percentage: number | null } | null;

    if (moduleProgress) {
      progressPercentage = moduleProgress.completion_percentage || 0;

      const stagesProg = (await qb.read(completedStageProgressReadPolicy, {
        filters: [
          { column: "user_module_progress_id", op: "eq", value: moduleProgress.id },
          { column: "status", op: "eq", value: "completed" },
        ],
      })) as Array<{ stage_name: string }> | null;

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
  let modulesContentData: ModuleContentRow[] | null;
  try {
    modulesContentData = (await qb.read(moduleStageContentReadPolicy, {
      filters: [
        { column: "module_id", op: "eq", value: rawModule.id },
        { column: "stage_name", op: "in", value: allowedStages },
      ],
    })) as ModuleContentRow[] | null;
  } catch (error) {
    if (error instanceof QueryGatewayDatabaseError) {
      const causeMessage =
        error.cause && typeof error.cause === "object" && "message" in error.cause
          ? String(error.cause.message)
          : error.message;
      throw new Error(`Failed to fetch module stage content: ${causeMessage}`);
    }
    throw error;
  }

  const artifactTypeByStage = await getArtifactTypeByStage(qb, rawModule.id, ALL_STAGES);

  rawModule.modules_content = modulesContentData as unknown as ModuleContentRow[];
  const artifactIds = (rawModule.modules_content || [])
    .flatMap((mc) => mc.module_artifacts || [])
    .filter((artifact) => artifact.is_active)
    .map((artifact) => artifact.id);
  const submittedFilesByArtifactId = await getSubmittedFilesByArtifactId(qb, userId, artifactIds);

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
        moduleContext: mc.module_context || null,
        curriculumReference: mc.curriculum_reference ?? null,
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
      moduleContext: null,
      curriculumReference: null,
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
