import type { LteStageName } from "./stages";

export type Lte6eStage = LteStageName;

export type ContentType = "pdf" | "doc" | "video" | "image" | "slide" | "link" | "audio" | "text";
export type ArtifactResponseType = "text" | "file" | "url";

export interface EContentItem {
  id: string;
  contentType: ContentType;
  title: string;
  description: string | null;
  url: string;
  sortOrder: number;
  durationSeconds: number | null;
  xpReward: number | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  status: "draft" | "published" | "archived";
}

export interface ModuleArtifactQuestion {
  id: string;
  questionOrder: number;
  title: string;
  description: string;
  instructions: Record<string, unknown> | string;
  responseType: ArtifactResponseType;
  allowedFileTypes: string[] | null;
  maxFileSizeMb: number | null;
  responseRequired: boolean;
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

export interface ModuleArtifactSubmittedFile {
  id: string;
  submissionId: string;
  questionId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number | null;
  downloadUrl: string;
  attemptNo: number;
  versionLabel: string;
  isLatest: boolean;
  submittedAt: string | null;
  uploadedAt: string | null;
}

export interface ModuleArtifact {
  id: string;
  artifactType: "practice" | "final";
  totalScore: number;
  passingScore: number | null;
  questions: ModuleArtifactQuestion[];
  templates: ModuleArtifactTemplate[];
  submittedFiles: ModuleArtifactSubmittedFile[];
  isActive: boolean;
}

export interface ModuleStageContent {
  id: string;
  stageName: Lte6eStage;
  stageOrder: number;
  stageDescription: string;
  items: EContentItem[];
  artifacts: ModuleArtifact[];
  artifactType: "practice" | "final" | null;
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
  completedStages?: string[];
  isCompleted?: boolean;
  module_problem_statement?: string | null;
  pressure_points?: string[] | null;
  user_confusion?: string[] | null;
  industry_challenge?: string | null;
  prerequisites?: string[] | null;
  what_youll_learn?: string[] | null;
  when_to_apply?: string | null;
}

export interface LevelDetailsResponse {
  id: string;
  levelCode: string;
  capabilityName?: string;
  capabilityCode?: string;
  capabilitySlug?: string;
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
  progressPercentage?: number;
  completedStages?: string[];
}
