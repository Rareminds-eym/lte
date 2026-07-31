/** 6E Learning Stages: Engage → Explore → Explain → Express → Empower → Evolve */
export type Lte6eStage = "engage" | "explore" | "explain" | "express" | "empower" | "evolve";

/** Educational content types supported by the LTE system */
export type ContentType = "pdf" | "doc" | "video" | "image" | "slide" | "link" | "audio" | "text";

/** Educational content item within a stage. */
export interface EContentItem {
  id: string;
  contentType: ContentType;
  title: string;
  description: string | null;
  url: string;
  /** Display order within the stage */
  sortOrder: number;
  durationSeconds: number | null;
  xpReward: number | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  /** Content publication status. */
  status: "draft" | "published" | "archived";
}

export interface ModuleArtifactQuestion {
  id: string;
  questionOrder: number;
  title: string;
  description: string;
  instructions: Record<string, unknown> | string;
}

export interface ModuleArtifactTemplate {
  id: string;
  questionId: string | null;
  fileName: string;
  fileUrl: string;
  fileType: "pdf" | "word" | "excel" | "ppt" | "image" | "video" | "other";
  version: number;
  isDownloadable: boolean;
}

export interface ModuleArtifact {
  id: string;
  artifactType: "practice" | "final";
  totalScore: number;
  passingScore: number | null;
  questions: ModuleArtifactQuestion[];
  templates: ModuleArtifactTemplate[];
  isActive: boolean;
}

export interface ModuleStageContent {
  id: string;
  stageName: Lte6eStage;
  stageOrder: number;
  stageDescription: string;
  items: EContentItem[];
  artifacts: ModuleArtifact[];
  isActive: boolean;
}

export interface LevelProblemStatement {
  title: string;
  description: string;
}

export interface LevelModuleSummary {
  id: string;
  moduleNo: number;
  title: string;
  description: string;
  isPublished: boolean;
  progressPercentage?: number;
}

export interface LevelDetailsResponse {
  id: string;
  levelCode: string;
  capabilityName?: string;
  capabilityCode?: string;
  title: string;
  description: string;
  levelProblemStatement: LevelProblemStatement;
  observableBehavior: unknown;
  exampleOutputs: unknown;
  durationMinutes: number;
  levelNo?: number;
  levelLabel?: string;
  difficultyLevel: string;
  levelStatus: string;
  versionNo: number;
  artifactsCount: number;
  modules: LevelModuleSummary[];
}

export interface ModuleDetailsResponse {
  id: string;
  levelId: string;
  levelCode: string;
  levelTitle: string;
  moduleNo: number;
  title: string;
  description: string;
  moduleProblemStatement: string | null;
  pressurePoints: string[] | null;
  userConfusion: string[] | null;
  industryChallenge: string | null;
  prerequisites: string[] | null;
  whatYoullLearn: string[] | null;
  whenToApply: string | null;
  support: Record<string, unknown>;
  knowledge: Record<string, unknown>;
  tools: Record<string, unknown>;
  learningContent: Record<string, unknown>;
  stages: ModuleStageContent[];
}

// ============================================================================
// Database Row Types (Internal - used for Supabase response mapping)
// ============================================================================

/** Raw database row for levels table with nested modules */
export interface LevelRow {
  id: string;
  level_code: string;
  title: string;
  description: string;
  problem_statement: unknown;
  observable_behavior: unknown;
  example_outputs: unknown;
  duration_minutes: number;
  difficulty_level: string;
  status: string;
  version_no: number;
  capabilities?: {
    code: string;
    name: string;
  } | Array<{ code: string; name: string }>;
  level_scale?: {
    level_no: number;
    level_label: string;
  } | Array<{ level_no: number; level_label: string }>;
  modules?: Array<{
    id: string;
    module_no: number;
    title: string;
    description: string;
    is_published: boolean;
    is_active: boolean;
    modules_content?: Array<{
      id: string;
      module_artifacts?: Array<{
        artifact_type: string;
        is_active: boolean;
      }>;
    }>;
  }>;
}

/** Raw database row for e_content table */
export interface EContentRow {
  id: string;
  content_type: ContentType;
  title: string;
  description: string | null;
  url: string;
  sort_order: number;
  duration_seconds: number | null;
  xp_reward: number | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  status: "draft" | "published" | "archived";
}

/** Raw database row for artifact_questions table */
export interface QuestionRow {
  id: string;
  question_order: number;
  title: string;
  description: string;
  instructions: Record<string, unknown> | string;
}

/** Raw database row for artifact_templates table */
export interface ArtifactTemplateRow {
  id: string;
  question_id: string | null;
  file_name: string;
  file_url: string;
  file_type: "pdf" | "word" | "excel" | "ppt" | "image" | "video" | "other";
  version: number;
  is_downloadable: boolean;
}

/** Raw database row for module_artifacts table */
export interface ArtifactRow {
  id: string;
  artifact_type: "practice" | "final";
  total_score: number;
  passing_score: number | null;
  is_active: boolean;
  artifact_questions?: QuestionRow[];
  artifact_templates?: ArtifactTemplateRow[];
}

/** Raw database row for modules_content table (6E stages) */
export interface ModuleContentRow {
  id: string;
  stage_name: Lte6eStage;
  stage_order: number;
  stage_description: string | null;
  is_active: boolean;
  e_content?: EContentRow[];
  module_artifacts?: ArtifactRow[];
}

/** Raw database row for modules table */
export interface ModuleRow {
  id: string;
  level_id: string;
  module_no: number;
  title: string;
  description: string;
  module_problem_statement: string | null;
  pressure_points: string[] | null;
  user_confusion: string[] | null;
  industry_challenge: string | null;
  prerequisites: string[] | null;
  what_youll_learn: string[] | null;
  when_to_apply: string | null;
  support: Record<string, unknown>;
  knowledge: Record<string, unknown>;
  tools: Record<string, unknown>;
  learning_content: Record<string, unknown>;
  levels?:
    | {
        level_code: string;
        title: string;
      }
    | Array<{ level_code: string; title: string }>;
  modules_content?: ModuleContentRow[];
}
