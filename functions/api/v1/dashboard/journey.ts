import {
  getCapabilitiesByRoleId,
  getLevelsForCapability,
} from "@functions/api/v1/capabilities/queries";
import { getLevelWithModules } from "@functions/api/v1/courses/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type JourneyState = "active" | "completed" | "no_track";

export interface DashboardJourney {
  levelId: string;
  capabilityCode: string;
  capability: string;
  title: string;
  moduleInfo: string;
  output: string;
  whyItMatters: string;
  progressPercentage: number;
  completedCount: number;
  inProgressCount: number;
  remainingCount: number;
  moduleNo: number;
}

export interface DashboardJourneyResponse {
  success: boolean;
  data: DashboardJourney | null;
  state: JourneyState;
}

interface LevelProgressRow {
  id: string;
  level_id: string;
  status: string;
  updated_at: string;
}

/**
 * Most recent open learning inside the track's paths, ordered by real
 * activity: last module touched (last_activity_at), else last level
 * updated. Returns no levelId when nothing is started yet ("started"
 * false) or when every level row is completed ("started" true).
 */
async function findOpenLevel(
  supabase: SupabaseClient,
  userId: string,
  pathIds: string[],
): Promise<{ levelId?: string; moduleId?: string; started: boolean }> {
  const { data: rows } = await supabase
    .from("user_capability_level_progress")
    .select("id, level_id, status, updated_at")
    .eq("user_id", userId)
    .in("learning_path_id", pathIds)
    .order("sequence_no", { ascending: true });

  const allRows = (rows ?? []) as LevelProgressRow[];
  if (allRows.length === 0) return { started: false };

  const open = allRows.filter((r) => r.status !== "completed");
  if (open.length === 0) return { started: true };

  const { data: recentModule } = await supabase
    .from("user_module_progress")
    .select("module_id, user_capability_level_progress_id")
    .in(
      "user_capability_level_progress_id",
      open.map((r) => r.id),
    )
    .not("module_status", "in", '("completed","mastered")')
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentModule) {
    const row = open.find(
      (r) =>
        r.id ===
        (recentModule as { user_capability_level_progress_id: string })
          .user_capability_level_progress_id,
    );
    if (row) {
      return {
        levelId: row.level_id,
        moduleId: (recentModule as { module_id: string }).module_id,
        started: true,
      };
    }
  }

  const mostRecent = open.reduce((a, b) => ((a.updated_at ?? "") >= (b.updated_at ?? "") ? a : b));
  return { levelId: mostRecent.level_id, started: true };
}

/** Title of the module's first active artifact question, or null. */
async function findArtifactOutput(
  supabase: SupabaseClient,
  moduleId: string,
): Promise<string | null> {
  const { data: content } = await supabase
    .from("modules_content")
    .select("id, module_artifacts!inner(id, artifact_questions!inner(title, question_order))")
    .eq("module_id", moduleId)
    .eq("module_artifacts.is_active", true)
    .eq("artifact_questions.is_active", true);

  const questions = (
    (content ?? []) as Array<{
      module_artifacts?: Array<{
        artifact_questions?: Array<{ title: string; question_order: number | null }>;
      }>;
    }>
  )
    .flatMap((c) => (c.module_artifacts ?? []).flatMap((a) => a.artifact_questions ?? []))
    .sort((a, b) => (a.question_order ?? 0) - (b.question_order ?? 0));

  return questions[0]?.title ?? null;
}

async function buildJourney(
  supabase: SupabaseClient,
  userId: string,
  levelId: string,
  preferredModuleId: string | undefined,
): Promise<Response> {
  const details = await getLevelWithModules(supabase, levelId, userId, false);
  if (!details || details.modules.length === 0) {
    return jsonResponse<DashboardJourneyResponse>({ success: true, data: null, state: "active" });
  }

  const current =
    details.modules.find((m) => m.id === preferredModuleId) ??
    details.modules.find((m) => !m.isCompleted) ??
    details.modules[details.modules.length - 1];
  if (!current) {
    return jsonResponse<DashboardJourneyResponse>({ success: true, data: null, state: "active" });
  }
  const total = details.modules.length;
  const completedCount = details.modules.filter((m) => m.isCompleted).length;
  const inProgressCount = details.modules.filter(
    (m) => !m.isCompleted && (m.progressPercentage ?? 0) > 0,
  ).length;
  const remainingCount = total - completedCount - inProgressCount;
  const progressPercentage = Math.round(
    details.modules.reduce((sum, m) => sum + (m.progressPercentage ?? 0), 0) / total,
  );

  const output = (await findArtifactOutput(supabase, current.id)) ?? current.description;
  const whyItMatters = current.industry_challenge ?? details.description;

  return jsonResponse<DashboardJourneyResponse>({
    success: true,
    state: "active",
    data: {
      levelId,
      capabilityCode: details.capabilityCode ?? "",
      capability: details.capabilityName ?? "",
      title: current.title,
      moduleInfo: `Module ${current.moduleNo + 1} of ${total}`,
      output,
      whyItMatters,
      progressPercentage,
      completedCount,
      inProgressCount,
      remainingCount,
      moduleNo: current.moduleNo,
    },
  });
}

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const supabase = createServiceSupabase(context.env);

    const track = await getActiveLearningTrack(supabase, user.sub);
    if (!track || track.roles.length === 0) {
      return jsonResponse<DashboardJourneyResponse>({
        success: true,
        data: null,
        state: "no_track",
      });
    }

    const pathIds = track.roles.map((r) => r.learningPathId);
    const { levelId, moduleId, started } = await findOpenLevel(supabase, user.sub, pathIds);

    if (levelId) {
      return buildJourney(supabase, user.sub, levelId, moduleId);
    }
    if (started) {
      return jsonResponse<DashboardJourneyResponse>({
        success: true,
        data: null,
        state: "completed",
      });
    }

    // nothing started yet: point at the first level of the track's first capability
    const firstRole = track.roles[0];
    if (!firstRole) {
      return jsonResponse<DashboardJourneyResponse>({
        success: true,
        data: null,
        state: "no_track",
      });
    }
    const capabilities = await getCapabilitiesByRoleId(supabase, firstRole.roleId);
    const firstCapability = capabilities[0];
    const levels = firstCapability
      ? await getLevelsForCapability(supabase, firstCapability.id)
      : [];
    const firstLevelId = levels[0]?.id;
    if (!firstLevelId) {
      return jsonResponse<DashboardJourneyResponse>({
        success: true,
        data: null,
        state: "no_track",
      });
    }

    return buildJourney(supabase, user.sub, firstLevelId, undefined);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }

    apiLogger.error("Failed to fetch dashboard journey", error, { requestId });
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonError(message, 500, { code: "SERVER_ERROR", requestId });
  }
}
