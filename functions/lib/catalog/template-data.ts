/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */

import type { CatalogDependencies } from "./dependencies";
import { type HttpRequest, HttpResponse } from "./http";
import { deterministicUUID } from "./ingestion/uuid-generator";

type TemplateColumn = { header: string; source?: string | null; pipe?: boolean };

const RAW_EXPORT_COLUMNS: Record<string, Array<string | TemplateColumn>> = {
  roles: ["id", "role_name", "role_family_name", "domain_name"],
  capabilities: ["id", "code", "name", "description", "slug", "master_sequence", "thumbnail_url"],
  level_scale: [
    "id",
    "level_no",
    { header: "level_code", source: null },
    "level_label",
    "generic_definition",
  ],
  role_capability_sequence: [
    "id",
    "role_id",
    "capability_id",
    "sequence_step",
    "capability_priority",
    "required_level",
    "duration_weeks",
    "work_style_demands",
  ],
  skills: ["id", "code", "name", "description", { header: "tags (|)", source: "tags", pipe: true }],
  levels: [
    "id",
    "level_code",
    "capability_id",
    "level_id",
    "title",
    "description",
    { header: "observable_behavior (|)", source: "observable_behavior", pipe: true },
    { header: "example_outputs (|)", source: "example_outputs", pipe: true },
    { header: "problem_statement (|)", source: "problem_statement", pipe: true },
    "duration_minutes",
    "difficulty_level",
    "total_xp",
  ],
  level_skills: ["id", "level_id", "skill_id"],
  modules: [
    { header: " Id ", source: "id" },
    "level_id",
    "module_no",
    "title",
    "description",
    { header: "pressure_points (|)", source: "pressure_points", pipe: true },
    { header: "user_confusion (|)", source: "user_confusion", pipe: true },
    { header: "Industry_challenge", source: "industry_challenge" },
    { header: "Prerequisites (|)", source: "prerequisites", pipe: true },
    { header: "WhatYoullLearn (|)", source: "what_youll_learn", pipe: true },
    { header: "whenToApply", source: "when_to_apply" },
    { header: "learning_content (|)", source: "learning_content", pipe: true },
    { header: "support (|)", source: "support", pipe: true },
    { header: "knowledge (|)", source: "knowledge", pipe: true },
    { header: "module_problem_statement", source: "module_problem_statement" },
    { header: "tools (|)", source: "tools", pipe: true },
  ],
  modules_content: [
    "id",
    "module_id",
    "stage_name",
    "stage_order",
    "stage_description",
    { header: "module_context ", source: "module_context" },
    { header: "curriculum_reference (|)", source: "curriculum_reference", pipe: true },
  ],
  e_content: [
    "id",
    "modules_content_id",
    "content_type",
    "title",
    "description",
    "url",
    "sort_order",
    "duration_seconds",
    "xp_reward",
    "mime_type",
    "file_size_bytes",
  ],
  module_artifacts: ["id", "modules_content_id", "artifact_type", "total_score", "passing_score"],
  artifact_questions: [
    "id",
    "artifact_id",
    "question_order",
    "title",
    "description",
    { header: "instructions (|)", source: "instructions", pipe: true },
    "response_type",
    { header: "allowed_file_types (|)", source: "allowed_file_types", pipe: true },
    "max_file_size_mb",
  ],
  artifact_templates: ["id", "artifact_id", "question_id", "file_name", "file_url", "file_type"],
};

const EXPORT_COLUMN_DEFS: Record<string, TemplateColumn[]> = Object.fromEntries(
  Object.entries(RAW_EXPORT_COLUMNS).map(([table, columns]) => [
    table,
    columns.map((column) =>
      typeof column === "string" ? { header: column, source: column } : column,
    ),
  ]),
);

type ExportRows = Record<string, any[]>;

function toLevelCodeCapabilityPart(capabilityCode: string): string {
  return (
    capabilityCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "CATALOG"
  );
}

function buildLevelCode(capabilityCode: string, levelNo: number): string {
  return `LTE_${toLevelCodeCapabilityPart(capabilityCode)}_L${levelNo}`;
}

export function createHandlers(dependencies: CatalogDependencies) {
  const supabaseLTE = dependencies.db;
  async function GET(request: HttpRequest) {
    const p = request.nextUrl.searchParams;
    return HttpResponse.json(
      await buildTemplateRows(
        p.get("levelCode") || undefined,
        p.get("capabilityCode") || p.get("capability") || undefined,
        p.get("levelNo") || p.get("level") || undefined,
      ),
    );
  }
  async function buildTemplateRows(
    sampleLevelCode?: string,
    capabilityCode?: string,
    levelNoParam?: string,
  ): Promise<ExportRows> {
    const [roles, capabilities, levelScale, roleCapabilitySequence] = await Promise.all([
      fetchRows("roles", "role_name"),
      fetchRows("capabilities", "master_sequence"),
      fetchRows("level_scale", "level_no"),
      fetchRows("role_capability_sequence", "sequence_step"),
    ]);

    const normalizedCapability = (capabilityCode || "").trim().toUpperCase();
    const requestedLevelNo = levelNoParam ? Number(levelNoParam) : NaN;
    const capability = normalizedCapability
      ? capabilities.find((row) => String(row.code || "").toUpperCase() === normalizedCapability)
      : undefined;
    const resolvedLevelCode =
      sampleLevelCode ||
      (capability && Number.isFinite(requestedLevelNo)
        ? buildLevelCode(capability.code, requestedLevelNo)
        : undefined);

    let sampleLevel = await fetchSampleLevel(resolvedLevelCode, capability?.id);
    if (!sampleLevel && capability && Number.isFinite(requestedLevelNo)) {
      // Pre-fill a stub row for the requested next level (e.g. L2/L3) so L&D can
      // fill a fresh level without cloning L1 ids. Publish treats it as insert
      // because the level_code is new; re-uploaded codes update instead.
      const levelScaleRow = levelScale.find((row) => Number(row.level_no) === requestedLevelNo);
      const levelCode = buildLevelCode(capability.code, requestedLevelNo);
      sampleLevel = {
        id: deterministicUUID("levels", levelCode),
        level_code: levelCode,
        capability_id: capability.id,
        level_id: levelScaleRow?.id || null,
        title: "",
        description: "",
        observable_behavior: null,
        example_outputs: null,
        problem_statement: null,
        duration_minutes: null,
        difficulty_level: null,
        total_xp: null,
      };
    }
    if (!sampleLevel) {
      return {
        roles,
        capabilities,
        level_scale: levelScale,
        role_capability_sequence: roleCapabilitySequence,
        skills: [],
        levels: [],
        level_skills: [],
        modules: [],
        modules_content: [],
        e_content: [],
        module_artifacts: [],
        artifact_questions: [],
        artifact_templates: [],
      };
    }

    const modules = await fetchRowsByValues("modules", "level_id", [sampleLevel.id], "module_no");
    const moduleIds = modules.map((row) => row.id);
    const modulesContent = await fetchRowsByValues(
      "modules_content",
      "module_id",
      moduleIds,
      "stage_order",
    );
    const moduleContentIds = modulesContent.map((row) => row.id);
    const eContent = await fetchRowsByValues(
      "e_content",
      "modules_content_id",
      moduleContentIds,
      "sort_order",
    );
    const moduleArtifacts = await fetchRowsByValues(
      "module_artifacts",
      "modules_content_id",
      moduleContentIds,
      "artifact_type",
    );
    const artifactIds = moduleArtifacts.map((row) => row.id);
    const artifactQuestions = await fetchRowsByValues(
      "artifact_questions",
      "artifact_id",
      artifactIds,
      "question_order",
    );
    const artifactTemplates = await fetchRowsByValues(
      "artifact_templates",
      "artifact_id",
      artifactIds,
      "file_name",
    );
    const levelSkills = await fetchRowsByValues(
      "level_skills",
      "level_id",
      [sampleLevel.id],
      "created_at",
    );
    const skillIds = levelSkills.map((row) => row.skill_id);
    const skills = await fetchRowsByValues("skills", "id", skillIds, "code");

    return {
      roles,
      capabilities,
      level_scale: levelScale,
      role_capability_sequence: roleCapabilitySequence,
      skills,
      levels: [sampleLevel],
      level_skills: levelSkills,
      modules,
      modules_content: modulesContent,
      e_content: eContent,
      module_artifacts: moduleArtifacts,
      artifact_questions: artifactQuestions,
      artifact_templates: artifactTemplates,
    };
  }

  async function fetchRows(tableName: string, orderColumn: string): Promise<any[]> {
    const columns = getSelectColumns(tableName);
    const { data, error } = await supabaseLTE
      .from(tableName)
      .select(columns.join(","))
      .order(orderColumn, { ascending: true });

    if (error) throw new Error(`Failed to export ${tableName}: ${error.message}`);
    return data || [];
  }

  async function fetchRowsByValues(
    tableName: string,
    filterColumn: string,
    values: string[],
    orderColumn: string,
  ): Promise<any[]> {
    if (values.length === 0) return [];

    const columns = getSelectColumns(tableName);
    const { data, error } = await supabaseLTE
      .from(tableName)
      .select(columns.join(","))
      .in(filterColumn, values)
      .order(orderColumn, { ascending: true });

    if (error) throw new Error(`Failed to export ${tableName}: ${error.message}`);
    return data || [];
  }

  async function fetchSampleLevel(levelCode?: string, capabilityId?: string): Promise<any | null> {
    const columns = getSelectColumns("levels");
    let query = supabaseLTE.from("levels").select(columns.join(",")).eq("is_active", true);

    if (levelCode) {
      query = query.eq("level_code", levelCode);
    } else if (capabilityId) {
      query = query.eq("capability_id", capabilityId);
    }

    const { data, error } = await query
      .order("level_code", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to export sample level: ${error.message}`);
    return data;
  }

  function getSelectColumns(tableName: string): string[] {
    return Array.from(
      new Set(
        EXPORT_COLUMN_DEFS[tableName]!.map((column) =>
          column.source === null ? null : column.source || column.header,
        ).filter((source): source is string => Boolean(source)),
      ),
    );
  }

  return { GET };
}
