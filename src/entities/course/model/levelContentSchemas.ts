import { z } from "zod";

const JsonRecordSchema = z.record(z.string(), z.unknown());
const NullableStringListSchema = z.array(z.string()).nullable();

export const Lte6eStageSchema = z.enum([
  "engage",
  "explore",
  "explain",
  "express",
  "empower",
  "evolve",
]);

export const ContentTypeSchema = z.enum([
  "pdf",
  "doc",
  "video",
  "image",
  "slide",
  "link",
  "audio",
  "text",
]);

export const EContentItemSchema = z.object({
  id: z.string(),
  contentType: ContentTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  sortOrder: z.number(),
  durationSeconds: z.number().nullable(),
  xpReward: z.number().nullable(),
  mimeType: z.string().nullable(),
  fileSizeBytes: z.number().nullable(),
  status: z.enum(["draft", "published", "archived"]),
});

export const ModuleArtifactQuestionSchema = z.object({
  id: z.string(),
  questionOrder: z.number(),
  title: z.string(),
  description: z.string(),
  instructions: z.union([JsonRecordSchema, z.string()]),
});

export const ModuleArtifactTemplateSchema = z.object({
  id: z.string(),
  questionId: z.string().nullable(),
  fileName: z.string(),
  fileUrl: z.string(),
  fileType: z.enum(["pdf", "word", "excel", "ppt", "image", "video", "other"]),
  version: z.number(),
  isDownloadable: z.boolean(),
});

export const ModuleArtifactSchema = z.object({
  id: z.string(),
  artifactType: z.enum(["practice", "final"]),
  totalScore: z.number(),
  passingScore: z.number().nullable(),
  questions: z.array(ModuleArtifactQuestionSchema),
  templates: z.array(ModuleArtifactTemplateSchema),
  isActive: z.boolean(),
});

export const ModuleStageContentSchema = z.object({
  id: z.string(),
  stageName: Lte6eStageSchema,
  stageOrder: z.number(),
  stageDescription: z.string(),
  items: z.array(EContentItemSchema),
  artifacts: z.array(ModuleArtifactSchema),
  isActive: z.boolean(),
});

export const LevelProblemStatementSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const LevelModuleSummarySchema = z.object({
  id: z.string(),
  moduleNo: z.number(),
  title: z.string(),
  description: z.string(),
  isPublished: z.boolean(),
  progressPercentage: z.number().optional(),
  completedStages: z.array(z.string()).optional(),
  isCompleted: z.boolean().optional(),
  module_problem_statement: z.string().nullable().optional(),
  pressure_points: z.array(z.string()).nullable().optional(),
  user_confusion: z.array(z.string()).nullable().optional(),
  industry_challenge: z.string().nullable().optional(),
  prerequisites: z.array(z.string()).nullable().optional(),
  what_youll_learn: z.array(z.string()).nullable().optional(),
  when_to_apply: z.string().nullable().optional(),
});

export const LevelDetailsResponseSchema = z.object({
  id: z.string(),
  levelCode: z.string(),
  capabilityName: z.string().optional(),
  capabilityCode: z.string().optional(),
  title: z.string(),
  description: z.string(),
  levelProblemStatement: LevelProblemStatementSchema,
  observableBehavior: z.unknown(),
  exampleOutputs: z.unknown(),
  durationMinutes: z.number(),
  levelNo: z.number().optional(),
  levelLabel: z.string().optional(),
  difficultyLevel: z.string(),
  levelStatus: z.string(),
  versionNo: z.number(),
  artifactsCount: z.number(),
  modules: z.array(LevelModuleSummarySchema),
});

export const ModuleDetailsResponseSchema = z.object({
  id: z.string(),
  levelId: z.string(),
  levelCode: z.string(),
  levelTitle: z.string(),
  moduleNo: z.number(),
  title: z.string(),
  description: z.string(),
  moduleProblemStatement: z.string().nullable(),
  pressurePoints: NullableStringListSchema,
  userConfusion: NullableStringListSchema,
  industryChallenge: z.string().nullable(),
  prerequisites: NullableStringListSchema,
  whatYoullLearn: NullableStringListSchema,
  whenToApply: z.string().nullable(),
  support: JsonRecordSchema,
  knowledge: JsonRecordSchema,
  tools: JsonRecordSchema,
  learningContent: JsonRecordSchema,
  stages: z.array(ModuleStageContentSchema),
  progressPercentage: z.number().optional(),
  completedStages: z.array(z.string()).optional(),
});

export const LevelDetailsPayloadSchema = z.object({
  success: z.literal(true),
  level: LevelDetailsResponseSchema,
});

export const ModuleDetailsPayloadSchema = z.object({
  success: z.literal(true),
  module: ModuleDetailsResponseSchema,
});
