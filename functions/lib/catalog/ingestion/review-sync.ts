/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
import type { LTELevelCourse } from "../types";

export interface SnapshotTable {
  columns: string[];
  rows: any[][];
}

export interface ReviewSyncResult {
  applied: number;
  warnings: string[];
}

function normKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function colIndex(table: SnapshotTable | undefined, column: string): number {
  if (!table) return -1;
  return table.columns.indexOf(column);
}

function findRowIndexBy(table: SnapshotTable | undefined, column: string, value: unknown): number {
  if (!table) return -1;
  const idx = colIndex(table, column);
  if (idx === -1) return -1;
  const want = normKey(value);
  return table.rows.findIndex((row) => normKey(row[idx]) === want);
}

/**
 * Write a value into a snapshot cell while preserving the stored type:
 * pipe-string cells stay pipe-strings, objects/arrays stay structured.
 */
function assignCell(existing: unknown, value: unknown): unknown {
  if (typeof existing === "string" && typeof value !== "string") {
    if (Array.isArray(value)) return value.join(" | ");
    if (value && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>)
        .map(
          ([key, entry]) =>
            `${key}: ${Array.isArray(entry) ? entry.join(", ") : String(entry ?? "")}`,
        )
        .join(" | ");
    }
  }
  return value;
}

function setCell(
  tables: Record<string, SnapshotTable>,
  tableName: string,
  rowIndex: number,
  column: string,
  value: unknown,
  result: ReviewSyncResult,
): void {
  const table = tables[tableName];
  if (!table || rowIndex < 0) return;
  const idx = colIndex(table, column);
  if (idx === -1) {
    result.warnings.push(`${tableName}.${column} column is missing in the snapshot; edit skipped.`);
    return;
  }
  if (value === undefined) return;
  table.rows[rowIndex]![idx] = assignCell(table.rows[rowIndex]![idx], value);
  result.applied += 1;
}

function mergePipeObjectCell(existing: unknown, patch: Record<string, unknown>): unknown {
  const clean: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(patch)) {
    if (entry === undefined || entry === null) continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    if (typeof entry === "string" && !entry.trim()) continue;
    clean[key] = entry;
  }
  if (Object.keys(clean).length === 0) return existing;
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return { ...(existing as Record<string, unknown>), ...clean };
  }
  if (typeof existing === "string" && existing.trim()) {
    const segments = existing
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const keep = segments.filter((segment) => {
      const key = segment.split(":")[0]?.trim().toLowerCase();
      return key && !(key in clean);
    });
    const additions = Object.entries(clean).map(([key, entry]) =>
      Array.isArray(entry) ? `${key}: ${entry.join(", ")}` : `${key}: ${String(entry)}`,
    );
    return [...keep, ...additions].join(" | ");
  }
  return clean;
}

function serializeInstructions(instructions: unknown): unknown {
  if (instructions === undefined || instructions === null) return instructions;
  if (typeof instructions === "string") return instructions;
  const parts: string[] = [];
  const record = instructions as Record<string, unknown>;
  if (record["required_fields"]) parts.push(`required: ${record["required_fields"]}`);
  if (record["pass_criteria"]) parts.push(`pass_criteria: ${record["pass_criteria"]}`);
  if (record["critical_fail"]) parts.push(`critical_fail: ${record["critical_fail"]}`);
  return parts.join(" | ");
}

function parseDurationToSeconds(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return undefined;
  const mins = text.match(/([\d.]+)\s*mins?/);
  if (mins) return Math.round(Number(mins[1]) * 60);
  const secs = text.match(/([\d.]+)\s*secs?/);
  if (secs) return Math.round(Number(secs[1]));
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * Push learner-preview (levelCourses) edits back into the normalized snapshot
 * tables so publish — which only upserts `tables` — persists them.
 * Matches rows by stable ids / natural keys; never creates rows.
 */
export function syncCourseEditsToTables(
  tables: Record<string, SnapshotTable>,
  course: LTELevelCourse,
): ReviewSyncResult {
  const result: ReviewSyncResult = { applied: 0, warnings: [] };

  const levelsTable = tables["levels"];
  let levelRowIndex = findRowIndexBy(levelsTable, "level_code", course.levelCode);
  if (levelRowIndex === -1) {
    levelRowIndex = findRowIndexBy(levelsTable, "id", course.levelCode);
  }
  if (levelRowIndex === -1) {
    result.warnings.push(`levels row for ${course.levelCode} not found; level edits skipped.`);
    return result;
  }
  const levelRowId = levelsTable!.rows[levelRowIndex]![colIndex(levelsTable, "id")];

  const meta = course.courseMetadata || ({} as LTELevelCourse["courseMetadata"]);
  setCell(tables, "levels", levelRowIndex, "title", meta.courseTitle, result);
  setCell(tables, "levels", levelRowIndex, "description", meta.courseSummary, result);
  setCell(tables, "levels", levelRowIndex, "problem_statement", meta.problemStatement, result);

  const modulesTable = tables["modules"];
  const eContentTable = tables["e_content"];
  const modulesContentTable = tables["modules_content"];
  const moduleArtifactsTable = tables["module_artifacts"];
  const artifactQuestionsTable = tables["artifact_questions"];
  const artifactTemplatesTable = tables["artifact_templates"];

  const eIndexById = new Map<string, number>();
  (eContentTable?.rows || []).forEach((row, index) => {
    const idIdx = colIndex(eContentTable, "id");
    if (
      idIdx !== -1 &&
      row[idIdx] !== undefined &&
      row[idIdx] !== null &&
      String(row[idIdx]).trim() !== ""
    ) {
      eIndexById.set(normKey(row[idIdx]), index);
    }
  });
  const mcIndexById = new Map<string, number>();
  (modulesContentTable?.rows || []).forEach((row, index) => {
    const idIdx = colIndex(modulesContentTable, "id");
    if (
      idIdx !== -1 &&
      row[idIdx] !== undefined &&
      row[idIdx] !== null &&
      String(row[idIdx]).trim() !== ""
    ) {
      mcIndexById.set(normKey(row[idIdx]), index);
    }
  });

  for (const module of course.modules || []) {
    let moduleRowIndex = -1;
    if (modulesTable) {
      const noIdx = colIndex(modulesTable, "module_no");
      const levelIdx = colIndex(modulesTable, "level_id");
      const idIdx = colIndex(modulesTable, "id");
      moduleRowIndex = modulesTable.rows.findIndex((row) => {
        const noMatch = noIdx === -1 || normKey(row[noIdx]) === normKey(module.index);
        const levelMatch = levelIdx === -1 || normKey(row[levelIdx]) === normKey(levelRowId);
        return noMatch && levelMatch;
      });
      if (moduleRowIndex === -1 && idIdx !== -1) {
        moduleRowIndex = modulesTable.rows.findIndex(
          (row) => levelIdx === -1 || normKey(row[levelIdx]) === normKey(levelRowId),
        );
        if (moduleRowIndex !== -1) {
          result.warnings.push(
            `modules row matched by level only for module index ${module.index}; verify module_no.`,
          );
        }
      }
    }
    if (moduleRowIndex === -1) {
      result.warnings.push(
        `modules row for module index ${module.index} not found; module edits skipped.`,
      );
      continue;
    }
    const moduleRowId = modulesTable!.rows[moduleRowIndex]![colIndex(modulesTable, "id")];

    setCell(tables, "modules", moduleRowIndex, "title", module.title, result);
    setCell(tables, "modules", moduleRowIndex, "description", module.contextDescription, result);
    setCell(
      tables,
      "modules",
      moduleRowIndex,
      "module_problem_statement",
      module.moduleProblemStatement,
      result,
    );
    setCell(tables, "modules", moduleRowIndex, "pressure_points", module.pressurePoints, result);
    setCell(tables, "modules", moduleRowIndex, "user_confusion", module.userConfusion, result);
    setCell(
      tables,
      "modules",
      moduleRowIndex,
      "industry_challenge",
      module.industryChallenge,
      result,
    );
    setCell(tables, "modules", moduleRowIndex, "prerequisites", module.prerequisites, result);
    setCell(tables, "modules", moduleRowIndex, "what_youll_learn", module.whatYoullLearn, result);
    setCell(tables, "modules", moduleRowIndex, "when_to_apply", module.whenToApply, result);

    for (const stage of module.stages || []) {
      const eRowIndex = eIndexById.get(normKey(stage.id)) ?? -1;
      const mcRowById = mcIndexById.get(normKey(stage.id)) ?? -1;

      // Resolve the modules_content row for curriculum fields via (module, stage name).
      let mcRowIndex = mcRowById;
      if (mcRowIndex === -1 && modulesContentTable) {
        const moduleIdx = colIndex(modulesContentTable, "module_id");
        const stageIdx = colIndex(modulesContentTable, "stage_name");
        mcRowIndex = modulesContentTable.rows.findIndex((row) => {
          const moduleMatch = moduleIdx === -1 || normKey(row[moduleIdx]) === normKey(moduleRowId);
          const stageMatch = stageIdx === -1 || normKey(row[stageIdx]) === normKey(stage.name);
          return moduleMatch && stageMatch;
        });
      }

      if (eRowIndex !== -1) {
        setCell(tables, "e_content", eRowIndex, "description", stage.description, result);
        setCell(tables, "e_content", eRowIndex, "content_type", stage.mediaType, result);
        setCell(tables, "e_content", eRowIndex, "xp_reward", stage.xpReward, result);
        const seconds = parseDurationToSeconds(stage.estimatedDuration);
        if (seconds !== undefined) {
          setCell(tables, "e_content", eRowIndex, "duration_seconds", seconds, result);
        }
      } else if (mcRowById !== -1) {
        setCell(
          tables,
          "modules_content",
          mcRowById,
          "stage_description",
          stage.description,
          result,
        );
      } else {
        result.warnings.push(
          `stage ${stage.name} (${stage.id}) matched no e_content/modules_content row; stage text skipped.`,
        );
      }

      if (mcRowIndex !== -1) {
        const mcTable = modulesContentTable!;
        const refIdx = colIndex(mcTable, "curriculum_reference");
        if (refIdx === -1) {
          result.warnings.push(
            "modules_content.curriculum_reference column is missing; stage curriculum edits skipped.",
          );
        } else {
          const merged = mergePipeObjectCell(mcTable.rows[mcRowIndex]![refIdx], {
            prerequisites: stage.prerequisites,
            technical_concepts: stage.technicalConcepts,
            when_to_use: stage.whenToUse,
            module_continuity: stage.moduleContinuity,
          });
          mcTable.rows[mcRowIndex]![refIdx] = merged;
          result.applied += 1;
        }
        setCell(
          tables,
          "modules_content",
          mcRowIndex,
          "module_context",
          stage.engineeringContext,
          result,
        );
      }

      for (const asset of stage.assets || []) {
        const assetRowIndex = eIndexById.get(normKey(asset.id)) ?? -1;
        if (assetRowIndex === -1) {
          result.warnings.push(`e_content asset ${asset.id} not found; asset edit skipped.`);
          continue;
        }
        setCell(tables, "e_content", assetRowIndex, "title", asset.title, result);
        setCell(tables, "e_content", assetRowIndex, "url", asset.url, result);
        setCell(tables, "e_content", assetRowIndex, "mime_type", asset.contentType, result);
        if (asset.fileName) {
          result.warnings.push(
            `e_content asset ${asset.id} fileName has no snapshot column; fileName edit skipped.`,
          );
        }
      }
    }

    for (const artifact of module.artifactPractices || []) {
      const artRowIndex = findRowIndexBy(moduleArtifactsTable, "id", artifact.id);
      if (artRowIndex === -1) {
        result.warnings.push(
          `module_artifacts row ${artifact.id} not found; artifact scores skipped.`,
        );
      } else {
        if (artifact.totalScore !== undefined) {
          setCell(
            tables,
            "module_artifacts",
            artRowIndex,
            "total_score",
            artifact.totalScore,
            result,
          );
        }
        if (artifact.passingScore !== undefined) {
          setCell(
            tables,
            "module_artifacts",
            artRowIndex,
            "passing_score",
            artifact.passingScore,
            result,
          );
        }
        if (artifact.title) {
          result.warnings.push(
            `artifact ${artifact.id} title has no snapshot column; title edit skipped.`,
          );
        }
      }

      for (const question of artifact.questions || []) {
        const qRowIndex = findRowIndexBy(artifactQuestionsTable, "id", question.id);
        if (qRowIndex === -1) {
          result.warnings.push(
            `artifact_questions row ${question.id} not found; question edit skipped.`,
          );
          continue;
        }
        setCell(tables, "artifact_questions", qRowIndex, "title", question.title, result);
        setCell(
          tables,
          "artifact_questions",
          qRowIndex,
          "description",
          question.description,
          result,
        );
        setCell(
          tables,
          "artifact_questions",
          qRowIndex,
          "instructions",
          serializeInstructions(question.instructions),
          result,
        );
      }

      for (const template of artifact.templates || []) {
        const tRowIndex = findRowIndexBy(artifactTemplatesTable, "id", template.id);
        if (tRowIndex === -1) {
          result.warnings.push(
            `artifact_templates row ${template.id} not found; template edit skipped.`,
          );
          continue;
        }
        setCell(tables, "artifact_templates", tRowIndex, "file_name", template.fileName, result);
        setCell(tables, "artifact_templates", tRowIndex, "file_url", template.fileUrl, result);
      }
    }
  }

  return result;
}
