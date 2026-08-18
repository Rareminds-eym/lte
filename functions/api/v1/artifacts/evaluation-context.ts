import type { ArtifactEvaluationInput } from "@functions/lib/artifact-evaluator";
import { extractArtifactContent } from "@functions/lib/artifact-evaluator";
import {
  asQueryGateway,
  QueryGatewayDatabaseError,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import { apiLogger } from "@functions/shared/logger";

const evaluationArtifactReadPolicy = {
  table: "module_artifacts",
  operation: "read",
  columns: ["id", "modules_content_id"],
  filters: ["id"],
} as const;

const evaluationModuleContentReadPolicy = {
  table: "modules_content",
  operation: "read",
  columns: ["id", "module_id", "stage_name", "stage_order", "stage_description"],
  filters: ["id"],
} as const;

const evaluationModuleReadPolicy = {
  table: "modules",
  operation: "read",
  columns: [
    "id",
    "level_id",
    "module_no",
    "title",
    "module_problem_statement",
    "industry_challenge",
    "pressure_points",
    "what_youll_learn",
  ],
  filters: ["id"],
} as const;

const evaluationLevelReadPolicy = {
  table: "levels",
  operation: "read",
  columns: ["id", "capability_id", "title", "problem_statement", "observable_behavior"],
  filters: ["id"],
} as const;

const evaluationCapabilityReadPolicy = {
  table: "capabilities",
  operation: "read",
  columns: ["code", "name"],
  filters: ["id"],
} as const;

const artifactTemplatesReadPolicy = {
  table: "artifact_templates",
  operation: "read",
  columns: ["id", "question_id", "file_name", "file_url", "file_type", "version"],
  filters: ["artifact_id"],
  sorts: ["version"],
  maxPageSize: 100,
} as const;

interface EvaluationLevelRow {
  id: string;
  capability_id?: string | null;
  title?: string | null;
  problem_statement?: unknown;
  observable_behavior?: unknown;
}

interface EvaluationCapabilityRow {
  code?: string | null;
  name?: string | null;
}

interface ArtifactTemplateRow {
  id: string;
  question_id?: string | null;
  file_name: string;
  file_url?: string | null;
  file_type?: string | null;
  version?: number | null;
}

export async function fetchEvaluationContext(
  source: QueryGatewaySource,
  artifactId: string,
): Promise<ArtifactEvaluationInput["evaluationContext"] | undefined> {
  try {
    const qb = asQueryGateway(source);
    const art = (await qb.read(evaluationArtifactReadPolicy, {
      filters: [{ column: "id", op: "eq", value: artifactId }],
      result: "single",
    })) as { id: string; modules_content_id?: string | null } | null;

    if (!art?.modules_content_id) {
      return undefined;
    }

    const mc = (await qb.read(evaluationModuleContentReadPolicy, {
      filters: [{ column: "id", op: "eq", value: art.modules_content_id }],
      result: "single",
    })) as {
      id: string;
      module_id?: string | null;
      stage_name?: string | null;
      stage_order?: number | null;
      stage_description?: string | null;
    } | null;

    if (!mc?.module_id) {
      return undefined;
    }

    const mod = (await qb.read(evaluationModuleReadPolicy, {
      filters: [{ column: "id", op: "eq", value: mc.module_id }],
      result: "single",
    })) as {
      id: string;
      level_id?: string | null;
      module_no?: number | null;
      title?: string | null;
      module_problem_statement?: string | null;
      industry_challenge?: string | null;
      pressure_points?: unknown;
      what_youll_learn?: unknown;
    } | null;

    if (!mod?.level_id) {
      return undefined;
    }

    let lvl: EvaluationLevelRow | null = null;
    try {
      const levelRow = await qb.read(evaluationLevelReadPolicy, {
        filters: [{ column: "id", op: "eq", value: mod.level_id }],
        result: "maybeSingle",
      });
      lvl = levelRow as EvaluationLevelRow | null;
    } catch (lvlError) {
      apiLogger.warn("Failed to fetch level for evaluation context", {
        artifactId,
        levelId: mod.level_id,
        error: lvlError,
      });
    }

    const cap = lvl?.capability_id
      ? ((await qb.read(evaluationCapabilityReadPolicy, {
          filters: [{ column: "id", op: "eq", value: lvl.capability_id }],
          result: "maybeSingle",
        })) as EvaluationCapabilityRow | null)
      : null;

    let levelProblemStatement: { title: string; description: string } | undefined;
    if (lvl?.problem_statement) {
      if (
        typeof lvl.problem_statement === "object" &&
        lvl.problem_statement !== null &&
        "title" in lvl.problem_statement
      ) {
        const ps = lvl.problem_statement as { title?: string; description?: string };
        levelProblemStatement = {
          title: String(ps.title ?? lvl.title ?? ""),
          description: String(ps.description ?? ""),
        };
      } else if (typeof lvl.problem_statement === "string") {
        levelProblemStatement = {
          title: lvl.title ?? "Problem Statement",
          description: lvl.problem_statement,
        };
      }
    }

    return {
      capabilityName: cap?.name ?? undefined,
      capabilityCode: cap?.code ?? undefined,
      levelTitle: lvl?.title ?? undefined,
      levelProblemStatement,
      observableBehavior: lvl?.observable_behavior ?? undefined,
      moduleNo: mod.module_no ?? undefined,
      moduleTitle: mod.title ?? undefined,
      moduleProblemStatement: mod.module_problem_statement ?? undefined,
      industryChallenge: mod.industry_challenge ?? undefined,
      pressurePoints: Array.isArray(mod.pressure_points)
        ? mod.pressure_points.map(String)
        : undefined,
      whatYoullLearn: Array.isArray(mod.what_youll_learn)
        ? mod.what_youll_learn.map(String)
        : undefined,
      stageName: mc.stage_name ?? undefined,
      stageOrder: mc.stage_order ?? undefined,
      stageDescription: mc.stage_description ?? undefined,
    };
  } catch (error) {
    if (error instanceof QueryGatewayDatabaseError) {
      apiLogger.warn("Failed to fetch evaluation context chain", { artifactId, error });
      return undefined;
    }
    apiLogger.warn("Failed to fetch evaluation context chain", { artifactId, error });
    return undefined;
  }
}

export async function fetchArtifactTemplateContent(
  source: QueryGatewaySource,
  artifactId: string,
): Promise<Map<string, string>> {
  const templateMap = new Map<string, string>();
  try {
    const qb = asQueryGateway(source);
    const templates = (await qb.read(artifactTemplatesReadPolicy, {
      filters: [{ column: "artifact_id", op: "eq", value: artifactId }],
      sort: [{ column: "version", ascending: false }],
    })) as ArtifactTemplateRow[] | null;

    if (!templates || templates.length === 0) return templateMap;

    for (const template of templates) {
      if (!template.file_url?.startsWith("https")) continue;
      if (template.file_type === "image" || template.file_type === "video") continue;

      const key = template.question_id ?? "__artifact__";
      if (templateMap.has(key)) continue;

      try {
        const res = await fetch(template.file_url);
        if (!res.ok) continue;
        const buffer = await res.arrayBuffer();
        const file = new File([buffer], template.file_name);
        const extracted = await extractArtifactContent(file, buffer);
        if (extracted.isReadable && extracted.extractedText.trim().length > 0) {
          templateMap.set(key, extracted.extractedText);
        }
      } catch (templateError) {
        apiLogger.warn("Failed to fetch or extract artifact template", {
          artifactId,
          templateId: template.id,
          fileName: template.file_name,
          error: templateError,
        });
      }
    }
  } catch (err) {
    apiLogger.warn("Error querying artifact_templates", { artifactId, error: err });
  }
  return templateMap;
}
