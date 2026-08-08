import type { ArtifactEvaluationInput } from "@functions/lib/artifact-evaluator";
import { extractArtifactContent } from "@functions/lib/artifact-evaluator";
import { apiLogger } from "@functions/shared/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchEvaluationContext(
  supabase: SupabaseClient,
  artifactId: string,
): Promise<ArtifactEvaluationInput["evaluationContext"] | undefined> {
  try {
    const { data: art, error: artError } = await supabase
      .from("module_artifacts")
      .select("id, modules_content_id")
      .eq("id", artifactId)
      .single();

    if (artError || !art?.modules_content_id) return undefined;

    const { data: mc, error: mcError } = await supabase
      .from("modules_content")
      .select("id, module_id, stage_name, stage_order, stage_description")
      .eq("id", art.modules_content_id)
      .single();

    if (mcError || !mc?.module_id) return undefined;

    const { data: mod, error: modError } = await supabase
      .from("modules")
      .select(
        "id, level_id, module_no, title, module_problem_statement, industry_challenge, pressure_points, what_youll_learn",
      )
      .eq("id", mc.module_id)
      .single();

    if (modError || !mod?.level_id) return undefined;

    const { data: lvl } = await supabase
      .from("levels")
      .select("id, capability_id, title, problem_statement, observable_behavior")
      .eq("id", mod.level_id)
      .maybeSingle();

    const { data: cap } = lvl?.capability_id
      ? await supabase
          .from("capabilities")
          .select("code, name")
          .eq("id", lvl.capability_id)
          .maybeSingle()
      : { data: null };

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
    apiLogger.warn("Failed to fetch evaluation context chain", { artifactId, error });
    return undefined;
  }
}

export async function fetchArtifactTemplateContent(
  supabase: SupabaseClient,
  artifactId: string,
): Promise<Map<string, string>> {
  const templateMap = new Map<string, string>();
  try {
    const { data: templates, error } = await supabase
      .from("artifact_templates")
      .select("id, question_id, file_name, file_url, file_type, version")
      .eq("artifact_id", artifactId)
      .order("version", { ascending: false });

    if (error || !templates || templates.length === 0) return templateMap;

    for (const template of templates) {
      if (!template.file_url?.startsWith("http")) continue;
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
