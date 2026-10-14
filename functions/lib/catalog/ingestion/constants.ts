/**
 * LTE Ingestion Constants
 * Ported from excel_to_lte_seed.py
 */

// UUID namespace for deterministic UUID generation
export const UUID_NAMESPACE = "11f25d55-f94d-4dbd-8ad2-f09fb2de5d5f";

// Required 15 LTE tables in dependency order
export const REQUIRED_LTE_TABLES = [
  "roles",
  "capabilities",
  "level_scale",
  "role_capability_sequence",
  "skills",
  "levels",
  "level_skills",
  "modules",
  "modules_content",
  "e_content",
  "module_artifacts",
  "artifact_questions",
  "artifact_templates",
] as const;

export const EXPECTED_6E_STAGES = [
  "engage",
  "explore",
  "explain",
  "express",
  "empower",
  "evolve",
] as const;

export const EXPECTED_6E_STAGE_LABELS = [
  "Engage",
  "Explore",
  "Explain",
  "Express",
  "Empower",
  "Evolve",
] as const;

// Sheets to ignore during parsing
export const IGNORED_SHEETS = new Set([
  "README_INSTRUCTIONS",
  "ENUMS",
  "ENUMS_AND_RULES",
  "WRITING_EXAMPLES",
]);

// Existing reference tables populated by seed files
export const EXISTING_REFERENCE_TABLES = new Set([
  "roles",
  "capabilities",
  "level_scale",
  "role_capability_sequence",
]);

// Database unique lookup columns for conflict detection
export const DB_UNIQUE_LOOKUP_COLUMNS: Record<string, string[]> = {
  capabilities: ["code"],
  level_scale: ["level_no"],
  skills: ["code"],
  levels: ["level_code"],
};

// Foreign key natural key lookups
// Format: [table, fk_column] => [ref_table, ref_id_column, natural_key_columns]
export const FK_NATURAL_KEY_LOOKUPS: Record<string, [string, string, string[]]> = {
  "levels|capability_id": ["capabilities", "id", ["code"]],
  "levels|level_id": ["level_scale", "id", ["level_no"]],
  "role_capability_sequence|role_id": [
    "roles",
    "id",
    ["role_name", "role_family_name", "domain_name"],
  ],
  "role_capability_sequence|capability_id": ["capabilities", "id", ["code"]],
};

// Standard foreign key references
export const FK_TABLES: Record<string, string> = {
  "level_skills|level_id": "levels",
  "level_skills|skill_id": "skills",
  "modules|level_id": "levels",
  "modules_content|module_id": "modules",
  "e_content|modules_content_id": "modules_content",
  "module_artifacts|modules_content_id": "modules_content",
  "artifact_questions|artifact_id": "module_artifacts",
  "artifact_templates|artifact_id": "module_artifacts",
  "artifact_templates|question_id": "artifact_questions",
};

// Columns containing pipe-delimited JSON data
export const PIPE_JSON_COLUMNS = new Set([
  "levels|problem_statement",
  "levels|observable_behavior",
  "levels|example_outputs",
  "modules_content|curriculum_reference",
  "artifact_questions|instructions",
  "skills|tags",
  "modules|pressure_points",
  "modules|user_confusion",
  "modules|prerequisites",
  "modules|what_youll_learn",
  "modules|learning_content",
  "modules|support",
  "modules|knowledge",
  "modules|tools",
]);

// Columns containing pipe-delimited key:value pairs
export const PIPE_KEY_VALUE_COLUMNS = new Set([
  "levels|problem_statement",
  "modules_content|curriculum_reference",
  "artifact_questions|instructions",
]);

// Expected JSON structure keys for validation
export const MODULE_STRUCTURED_JSON_KEYS: Record<string, Set<string>> = {
  "modules|learning_content": new Set([
    "major_concepts",
    "implementation_context_when_to_use",
    "reason_behind_concept",
  ]),
  "modules|support": new Set(["ai_support_tips", "module_continuity_link"]),
  "modules|knowledge": new Set(["technical_concepts_learnt", "academic_refresher_concepts"]),
};

// Columns that default to empty JSON object
export const EMPTY_JSON_OBJECT_COLUMNS = new Set([
  "modules|learning_content",
  "modules|support",
  "modules|knowledge",
  "modules|tools",
]);

// Columns that default to empty JSON array
export const EMPTY_JSON_ARRAY_COLUMNS = new Set([
  "modules|pressure_points",
  "modules|user_confusion",
  "modules|prerequisites",
  "modules|what_youll_learn",
]);

// Text values that represent JSON null
export const JSON_NULL_TEXT_VALUES = new Set(["nil", "nill", "null", "none"]);

// URL column patterns
export const URL_COLUMNS = new Set([
  "url",
  "file_url",
  "thumbnail_url",
  "image_url",
  "cover_image_url",
  "icon_url",
]);

// Columns excluded from text validation
export const TEXT_VALIDATION_EXCLUDED_COLUMNS = new Set([
  "metadata",
  "created_at",
  "updated_at",
  "deleted_at",
  ...URL_COLUMNS,
]);

// Tables excluded from semicolon validation
export const SEMICOLON_VALIDATION_EXCLUDED_TABLES = new Set([
  "capabilities",
  "role_capability_sequence",
]);

// Database default columns (not in Excel)
export const DATABASE_DEFAULT_COLUMNS = new Set(["created_at", "total_xp", "updated_at"]);

// Columns skipped during seed generation
export const SKIPPED_SEED_COLUMNS = new Set(["metadata", "created_at", "updated_at", "deleted_at"]);

// Excel-only columns not in database
export const EXCEL_ONLY_COLUMNS = new Set(["level_scale|level_code"]);

// Drive file URL patterns
export const DRIVE_FILE_PATTERN = /drive\.google\.com\/file\/d\/([^/?]+)/;
export const GOOGLE_EDITOR_FILE_PATTERN =
  /docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([^/?]+)/;

// Upload Modes (v1.5 spec)
export const UPLOAD_MODES = {
  ADD_NEW: "ADD_NEW",
  PATCH_UPDATE: "PATCH_UPDATE",
  ADD_AND_UPDATE: "ADD_AND_UPDATE",
  FULL_REPLACEMENT: "FULL_REPLACEMENT",
} as const;

export type UploadMode = keyof typeof UPLOAD_MODES;

// Mapping Resolution Status (v1.5 spec)
export const MAPPING_RESOLUTION_STATUS = {
  MATCHED: "MATCHED",
  SUGGESTED: "SUGGESTED",
  CREATE_NEW: "CREATE_NEW",
  CONFLICT: "CONFLICT",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
} as const;

export type MappingResolutionStatus = keyof typeof MAPPING_RESOLUTION_STATUS;

// Content Change Status (v1.5 spec)
export const CONTENT_CHANGE_STATUS = {
  NOT_APPLICABLE: "NOT_APPLICABLE",
  ADDED: "ADDED",
  UNCHANGED: "UNCHANGED",
  MODIFIED: "MODIFIED",
  REMOVED: "REMOVED",
} as const;

export type ContentChangeStatus = keyof typeof CONTENT_CHANGE_STATUS;

// v1.5 Template Contract Sheets
export const V1_5_SHEETS = [
  "UPLOAD_INFO",
  "CAPABILITIES",
  "ROLES",
  "ROLE_CAPABILITY_MAP",
  "CAPABILITY_COURSE_MAP",
  "CAPABILITY_COURSE_PLAN",
  "COURSES",
  "COURSE_LEVELS",
  "MODULES",
  "6E_CONTENT",
  "ARTIFACTS",
  "SKILLS",
  "MODULE_SKILL_MAP",
  "SOURCE_ASSETS",
] as const;
