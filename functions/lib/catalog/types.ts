/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
export type StageType6E = "Engage" | "Explore" | "Explain" | "Express" | "Empower" | "Evolve";

export interface LTEStage6E {
  id: string;
  stageIndex: number;
  name: StageType6E;
  label: string;
  subtitle: string;
  description: string;
  mediaType: "video" | "article" | "quiz" | "interactive";
  estimatedDuration: string;
  contentItemsCount: number;
  xpReward: number;
  prerequisites: string[];
  technicalConcepts: string[];
  engineeringContext: string;
  videoCtvContext?: string;
  whenToUse?: string;
  moduleContinuity?: string;
  isCompleted?: boolean;
  assets?: LTELearningAsset[];
}

export interface LTELearningAsset {
  id: string;
  url?: string;
  title: string;
  fileName?: string;
  contentType?: string;
}

export interface LTEArtifactPractice {
  id: string;
  moduleIndex: number;
  practiceIndex: 1 | 2;
  title: string;
  artifactType?: "practice" | "final";
  stageName?: StageType6E;
  totalScore?: number;
  passingScore?: number;
  questions?: LTEArtifactQuestion[];
  templates?: LTEArtifactTemplate[];
}

export interface LTEArtifactQuestion {
  id: string;
  title: string;
  description: string;
  instructions?:
    | string
    | {
        required_fields?: string;
        pass_criteria?: string;
        critical_fail?: string;
      };
  responseType?: string;
  required?: boolean;
}

export interface LTEArtifactTemplate {
  id: string;
  fileName: string;
  fileUrl?: string;
  fileType?: string;
  questionId?: string;
}

export interface LTEModule {
  index: number;
  title: string;
  subtitle: string;
  completionPercentage: number;
  status: "locked" | "in_progress" | "completed";
  stages: LTEStage6E[];
  artifactPractices: LTEArtifactPractice[];
  contextDescription: string;
  pressurePoints?: string[];
  userConfusion?: string[];
  industryChallenge?: string;
  prerequisites?: string[];
  whatYoullLearn?: string[];
  whenToApply?: string;
  moduleProblemStatement?: string;
}

export interface LTECourseMetadata {
  courseTitle: string;
  courseCode: string;
  domain: string;
  capabilityCode: string;
  capabilityLevel: string;
  instructorLead: string;
  courseSummary: string;
  problemStatement: string;
  capstoneTitle: string;
}

export interface LTETableSummary {
  tableName: string;
  rowCount: number;
  status: "ready" | "skipped" | "warning" | "error";
  details: string;
}

export interface LTESchemaValidationItem {
  id: string;
  code: string;
  title: string;
  message: string;
  category: "SCHEMA_VERIFICATION" | "CURRICULUM_6ES" | "ARTIFACTS" | "GENERAL";
  level: "info" | "warning" | "error";
  verified: boolean;
}

export interface LTERelationalValidationReport {
  verified: boolean;
  tableSummaries: LTETableSummary[];
  validationItems: LTESchemaValidationItem[];
  totalRowsParsed: number;
  errors: string[];
  warnings: string[];
}

export interface LTELevelCourse {
  levelCode: string;
  levelNo: number;
  levelName: string;
  courseMetadata: LTECourseMetadata;
  modules: LTEModule[];
}

export interface LTEIngestionSnapshot {
  draftRevision?: number;
  uploadId: string;
  sourceType: "google_sheets" | "xlsx";
  sourceName: string;
  snapshotHash: string;
  reviewedSnapshotHash?: string;
  tables?: Record<
    string,
    {
      columns: string[];
      rows: any[][];
    }
  >;
  metadata?: {
    sourceType: "xlsx" | "google_sheets";
    sourceName: string;
    tableCount: number;
    totalRows: number;
    parsedAt: string;
  };
  courseMetadata: LTECourseMetadata;
  modules: LTEModule[];
  levelCourses?: LTELevelCourse[];
  validationReport: LTERelationalValidationReport;
  createdAt: string;
  status:
    | "uploaded"
    | "validating"
    | "validated"
    | "publishing"
    | "published"
    | "validation_failed"
    | "publish_failed";
  assetStatus?: "none" | "staged" | "active" | "activation_pending" | "cleanup_pending";
}

export interface LTEUploadResponse {
  success: boolean;
  uploadId?: string;
  snapshot?: LTEIngestionSnapshot;
  error?: string;
}

export interface LTEPublishResult {
  success: boolean;
  status: string;
  inserted: number;
  skipped: number;
  completedAt: string;
  publishJobId?: string;
  assetValidation?: {
    total: number;
    validated: number;
    failed: number;
    pending?: number;
  };
  failedAssets?: Array<{
    url: string;
    errorCode?: string;
    error?: string;
    attempts?: number;
  }>;
  assetStatus?: string;
  catalogPublished?: boolean;
  assetsActive?: boolean;
  retryScheduled?: boolean;
  errorCode?: string;
  error?: string;
  tableSummary?: Record<string, { inserted: number; skipped: number }>;
}

export interface LTEPublishProgressState {
  status: "idle" | "queued" | "validating" | "publishing" | "published" | "failed";
  label: string;
  total?: number;
  validated?: number;
  failed?: number;
  pending?: number;
  error?: string;
}

export interface LearnerStageInfo {
  stage: LTEStage6E;
  module: LTEModule;
  currentStageIndex: number;
  totalStages: number;
}
