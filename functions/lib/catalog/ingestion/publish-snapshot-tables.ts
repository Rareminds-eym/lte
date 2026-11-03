/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { REQUIRED_LTE_TABLES } from "./constants";
import { deterministicUUID, isUUID } from "./uuid-generator";

type TableSummary = Record<string, { inserted: number; skipped: number }>;
const REFERENCE_TABLES = new Set([
  "roles",
  "capabilities",
  "level_scale",
  "role_capability_sequence",
]);

const PUBLISH_TABLES = REQUIRED_LTE_TABLES.filter((tableName) => !REFERENCE_TABLES.has(tableName));

const FK_TABLE_BY_COLUMN: Record<string, string> = {
  "role_capability_sequence|role_id": "roles",
  "role_capability_sequence|capability_id": "capabilities",
  "levels|capability_id": "capabilities",
  "levels|level_id": "level_scale",
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

interface ReferenceMaps {
  capabilitiesByIdOrCode: Map<string, string>;
  levelScaleByIdNoOrCode: Map<string, string>;
  skillsByCode: Map<string, string>;
  levelsByCode: Map<string, string>;
}

export async function publishSnapshotTables(
  tables: Record<string, { columns: string[]; rows: any[][] }>,
  client: SupabaseClient,
  assertOwned?: () => Promise<void>,
): Promise<{ inserted: number; skipped: number; tableSummary: TableSummary }> {
  let inserted = 0;
  let skipped = 0;
  const tableSummary: TableSummary = {};
  const effectiveClient = client;
  const references = await fetchReferenceMaps(effectiveClient);
  const idMap = buildUploadedIdMap(tables, references);

  for (const tableName of REQUIRED_LTE_TABLES) {
    const table = tables[tableName];
    if (!table || table.rows.length === 0) {
      tableSummary[tableName] = { inserted: 0, skipped: 0 };
      continue;
    }

    if (REFERENCE_TABLES.has(tableName)) {
      skipped += table.rows.length;
      tableSummary[tableName] = { inserted: 0, skipped: table.rows.length };
      continue;
    }

    if (!PUBLISH_TABLES.includes(tableName as any)) {
      tableSummary[tableName] = { inserted: 0, skipped: table.rows.length };
      skipped += table.rows.length;
      continue;
    }

    const rows = table.rows
      .map((row) => rowToObject(table.columns, row))
      .map((row) => resolvePublishRow(tableName, row, idMap, references));

    await assertOwned?.();
    const { error } = await effectiveClient
      .from(tableName)
      .upsert(rows, { onConflict: "id", ignoreDuplicates: false });
    await assertOwned?.();

    if (error) {
      throw new Error(`Failed to publish ${tableName}: ${error.message}`);
    }

    inserted += rows.length;
    tableSummary[tableName] = { inserted: rows.length, skipped: 0 };
  }

  return { inserted, skipped, tableSummary };
}

function rowToObject(columns: string[], row: any[]): Record<string, any> {
  return columns.reduce<Record<string, any>>((acc, column, index) => {
    acc[column] = row[index];
    return acc;
  }, {});
}

async function fetchReferenceMaps(client: SupabaseClient): Promise<ReferenceMaps> {
  const [capabilitiesResult, levelScaleResult, skillsResult, levelsResult] = await Promise.all([
    client.from("capabilities").select("id, code"),
    client.from("level_scale").select("id, level_no, level_label"),
    client.from("skills").select("id, code"),
    client.from("levels").select("id, level_code"),
  ]);

  if (capabilitiesResult.error) {
    throw new Error(`Failed to read existing capabilities: ${capabilitiesResult.error.message}`);
  }
  if (levelScaleResult.error) {
    throw new Error(`Failed to read existing level_scale: ${levelScaleResult.error.message}`);
  }
  if (skillsResult.error) {
    throw new Error(`Failed to read existing skills: ${skillsResult.error.message}`);
  }
  if (levelsResult.error) {
    throw new Error(`Failed to read existing levels: ${levelsResult.error.message}`);
  }

  const capabilitiesByIdOrCode = new Map<string, string>();
  for (const row of capabilitiesResult.data || []) {
    addReference(capabilitiesByIdOrCode, row.id, row.id);
    addReference(capabilitiesByIdOrCode, row.code, row.id);
  }

  const levelScaleByIdNoOrCode = new Map<string, string>();
  for (const row of levelScaleResult.data || []) {
    addReference(levelScaleByIdNoOrCode, row.id, row.id);
    addReference(levelScaleByIdNoOrCode, row.level_no, row.id);
    addReference(levelScaleByIdNoOrCode, `L${row.level_no}`, row.id);
    addReference(levelScaleByIdNoOrCode, row.level_label, row.id);
  }

  const skillsByCode = new Map<string, string>();
  for (const row of skillsResult.data || []) {
    addReference(skillsByCode, row.id, row.id);
    addReference(skillsByCode, row.code, row.id);
  }

  const levelsByCode = new Map<string, string>();
  for (const row of levelsResult.data || []) {
    addReference(levelsByCode, row.id, row.id);
    addReference(levelsByCode, row.level_code, row.id);
  }

  return {
    capabilitiesByIdOrCode,
    levelScaleByIdNoOrCode,
    skillsByCode,
    levelsByCode,
  };
}

function buildUploadedIdMap(
  tables: Record<string, { columns: string[]; rows: any[][] }>,
  references: ReferenceMaps,
): Map<string, string> {
  const idMap = new Map<string, string>();

  for (const [tableName, table] of Object.entries(tables)) {
    const idIndex = table.columns.indexOf("id");
    if (idIndex === -1) continue;

    for (const row of table.rows) {
      const originalId = row[idIndex];
      if (originalId === null || originalId === undefined || String(originalId).trim() === "")
        continue;

      let resolvedId: string | undefined;
      if (tableName === "level_scale") {
        resolvedId = references.levelScaleByIdNoOrCode.get(normalizeLookupKey(originalId));
      } else if (!REFERENCE_TABLES.has(tableName)) {
        resolvedId = toPublishUUID(tableName, originalId);
      }

      if (resolvedId) {
        addReference(idMap, originalId, resolvedId);
      }
    }
  }

  const capabilities = tables["capabilities"];
  if (capabilities) {
    const codeIndex = capabilities.columns.indexOf("code");
    const idIndex = capabilities.columns.indexOf("id");
    if (codeIndex !== -1) {
      for (const row of capabilities.rows) {
        const resolvedId = references.capabilitiesByIdOrCode.get(
          normalizeLookupKey(row[codeIndex]),
        );
        if (resolvedId) {
          addReference(idMap, row[codeIndex], resolvedId);
          if (idIndex !== -1) addReference(idMap, row[idIndex], resolvedId);
        }
      }
    }
  }

  const levelScale = tables["level_scale"];
  if (levelScale) {
    const idIndex = levelScale.columns.indexOf("id");
    const levelNoIndex = levelScale.columns.indexOf("level_no");
    const levelCodeIndex = levelScale.columns.indexOf("level_code");
    for (const row of levelScale.rows) {
      const candidates = [idIndex, levelNoIndex, levelCodeIndex]
        .filter((index) => index !== -1)
        .map((index) => row[index]);
      const resolvedId = candidates
        .map((candidate) => references.levelScaleByIdNoOrCode.get(normalizeLookupKey(candidate)))
        .find(Boolean);
      if (resolvedId) {
        for (const candidate of candidates) addReference(idMap, candidate, resolvedId);
      }
    }
  }

  // Incremental upload: reuse existing level ids by level_code so re-uploading
  // L1 alongside new L2/L3 updates L1 instead of inserting a duplicate row.
  const levels = tables["levels"];
  if (levels) {
    const idIndex = levels.columns.indexOf("id");
    const codeIndex = levels.columns.indexOf("level_code");
    if (codeIndex !== -1) {
      for (const row of levels.rows) {
        const resolvedId = references.levelsByCode.get(normalizeLookupKey(row[codeIndex]));
        if (resolvedId) {
          addReference(idMap, row[codeIndex], resolvedId);
          if (idIndex !== -1) addReference(idMap, row[idIndex], resolvedId);
        }
      }
    }
  }

  // Incremental upload: reuse existing skill ids by code for the same reason.
  const skills = tables["skills"];
  if (skills) {
    const idIndex = skills.columns.indexOf("id");
    const codeIndex = skills.columns.indexOf("code");
    const legacyCodeIndex = skills.columns.indexOf("skill_code");
    const effectiveCodeIndex = codeIndex !== -1 ? codeIndex : legacyCodeIndex;
    if (effectiveCodeIndex !== -1) {
      for (const row of skills.rows) {
        const resolvedId = references.skillsByCode.get(normalizeLookupKey(row[effectiveCodeIndex]));
        if (resolvedId) {
          addReference(idMap, row[effectiveCodeIndex], resolvedId);
          if (idIndex !== -1) addReference(idMap, row[idIndex], resolvedId);
          if (codeIndex !== -1) addReference(idMap, row[codeIndex], resolvedId);
          if (legacyCodeIndex !== -1) addReference(idMap, row[legacyCodeIndex], resolvedId);
        }
      }
    }
  }

  return idMap;
}

function resolvePublishRow(
  tableName: string,
  row: Record<string, any>,
  idMap: Map<string, string>,
  references: ReferenceMaps,
): Record<string, any> {
  const resolved = normalizePublishRow(tableName, row);

  if ("id" in resolved) {
    const existingId = idMap.get(normalizeLookupKey(row["id"]));
    // Reuse existing DB id for incremental re-uploads (levels by level_code,
    // skills by code). Otherwise generate a stable deterministic UUID.
    resolved["id"] = existingId || toPublishUUID(tableName, resolved["id"]);
    addReference(idMap, row["id"], resolved["id"]);
  }

  for (const [column, value] of Object.entries(row)) {
    const fkTable = FK_TABLE_BY_COLUMN[`${tableName}|${column}`];
    if (!fkTable || value === null || value === undefined || String(value).trim() === "") continue;

    const lookupKey = normalizeLookupKey(value);
    let mappedValue = idMap.get(lookupKey);

    if (!mappedValue && fkTable === "capabilities") {
      mappedValue = references.capabilitiesByIdOrCode.get(lookupKey);
    }
    if (!mappedValue && fkTable === "level_scale") {
      mappedValue = references.levelScaleByIdNoOrCode.get(lookupKey);
    }
    if (!mappedValue && fkTable === "skills") {
      mappedValue = references.skillsByCode.get(lookupKey);
    }
    if (!mappedValue && fkTable === "levels") {
      mappedValue = references.levelsByCode.get(lookupKey);
    }

    if (!mappedValue) {
      throw new Error(
        `Cannot resolve ${tableName}.${column} value "${value}". Use the DB template values for existing roles/capabilities/level scale, and keep uploaded course rows internally consistent.`,
      );
    }

    resolved[column] = mappedValue;
  }

  return resolved;
}

function normalizePublishRow(tableName: string, row: Record<string, any>): Record<string, any> {
  const normalized = { ...row };

  // created_at/updated_at are NOT NULL DEFAULT now() on every publish table.
  // Blank workbook cells arrive as explicit null, which would violate the
  // constraint, so drop them and let the DB default apply. Non-empty values
  // (original Excel timestamps) are preserved as-is.
  dropBlankDefaulted(normalized, "created_at");
  dropBlankDefaulted(normalized, "updated_at");

  if (tableName === "skills" && !normalized["code"] && normalized["skill_code"]) {
    normalized["code"] = normalized["skill_code"];
  }
  if (tableName === "skills") {
    delete normalized["skill_code"];
    normalizeJsonArray(normalized, "tags");
  }

  if (tableName === "levels") {
    normalized["total_xp"] = numberOrDefault(normalized["total_xp"], 0);
    normalized["duration_minutes"] = numberOrDefault(normalized["duration_minutes"], 0);
    normalizeJsonArray(normalized, "observable_behavior");
    normalizeJsonArray(normalized, "example_outputs");
    normalized["status"] = "published";
    normalized["is_active"] = true;
  }

  if (tableName === "modules") {
    normalized["module_no"] = numberOrDefault(normalized["module_no"], 0);
    // modules.prerequisites / pressure_points / user_confusion / what_youll_learn /
    // knowledge / learning_content / support / tools are all jsonb NOT NULL.
    // Blank workbook cells arrive as null and would violate the constraint,
    // so default them the same way levels.observable_behavior is handled.
    normalizeJsonArray(normalized, "pressure_points");
    normalizeJsonArray(normalized, "user_confusion");
    normalizeJsonArray(normalized, "prerequisites");
    normalizeJsonArray(normalized, "what_youll_learn");
    normalizeJsonObject(normalized, "knowledge");
    normalizeJsonObject(normalized, "learning_content");
    normalizeJsonObject(normalized, "support");
    normalizeJsonObject(normalized, "tools");
  }

  if (tableName === "modules_content") {
    normalized["stage_order"] = numberOrDefault(normalized["stage_order"], 0);
  }

  if (tableName === "e_content") {
    normalized["sort_order"] = numberOrDefault(normalized["sort_order"], 0);
    normalized["duration_seconds"] = numberOrDefault(normalized["duration_seconds"], 0);
    normalized["xp_reward"] = numberOrDefault(normalized["xp_reward"], 0);
    deleteBlankOptional(normalized, "file_size_bytes");
  }

  if (tableName === "module_artifacts") {
    normalized["total_score"] = numberOrDefault(normalized["total_score"], 0);
    deleteBlankOptional(normalized, "passing_score");
  }

  if (tableName === "artifact_questions") {
    normalized["question_order"] = numberOrDefault(normalized["question_order"], 1);
    normalizeTextArray(normalized, "allowed_file_types");
    // artifact_questions.instructions is jsonb NOT NULL.
    normalizeJsonObject(normalized, "instructions");
    deleteBlankOptional(normalized, "max_file_size_mb");
  }

  if (tableName === "level_skills") {
    delete normalized["weightage"];
    delete normalized["is_active"];
    delete normalized["metadata"];
  }

  return normalized;
}

function numberOrDefault(value: unknown, fallback: number): number {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function deleteBlankOptional(row: Record<string, any>, column: string): void {
  if (row[column] === null || row[column] === undefined || String(row[column]).trim() === "") {
    delete row[column];
  }
}

/**
 * Drop blank values for columns that have a DB DEFAULT (e.g. created_at /
 * updated_at DEFAULT now()). Omitting the key lets Postgres apply the default;
 * sending explicit null would violate the NOT NULL constraint.
 */
function dropBlankDefaulted(row: Record<string, any>, column: string): void {
  deleteBlankOptional(row, column);
}

function normalizeTextArray(row: Record<string, any>, column: string): void {
  const values = parseListValue(row[column]);
  if (!values.length) {
    delete row[column];
    return;
  }
  row[column] = values;
}

function normalizeJsonArray(row: Record<string, any>, column: string): void {
  const value = row[column];
  if (value === null || value === undefined || String(value).trim() === "") {
    row[column] = [];
    return;
  }
  if (Array.isArray(value)) {
    row[column] = value;
    return;
  }
  // Plain objects are already valid jsonb (e.g. parsed key: value pipe cells).
  // Passing them through avoids corrupting them into ["[object Object]"].
  if (typeof value === "object") {
    row[column] = value;
    return;
  }
  row[column] = parseListValue(value);
}

/**
 * Default empty values to {} for jsonb NOT NULL columns that hold objects
 * (e.g. modules.learning_content/support/tools, artifact_questions.instructions).
 * Non-empty values pass through untouched so parsed snapshot shapes are preserved.
 */
function normalizeJsonObject(row: Record<string, any>, column: string): void {
  const value = row[column];
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    row[column] = {};
    return;
  }
  if (typeof value === "string") {
    try {
      row[column] = JSON.parse(value);
    } catch {
      // Leave non-JSON strings untouched; validation reports them instead.
    }
  }
}

function parseListValue(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const text = String(value).trim();
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to delimiter parsing for malformed JSON-like text.
    }
  }

  return text
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPublishUUID(tableName: string, value: unknown): string {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(`${tableName}.id is required before publish`);
  }
  return isUUID(text) ? text.toLowerCase() : deterministicUUID(tableName, text);
}

function addReference(map: Map<string, string>, key: unknown, value: string): void {
  if (key === null || key === undefined || String(key).trim() === "") return;
  map.set(normalizeLookupKey(key), value);
}

function normalizeLookupKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
