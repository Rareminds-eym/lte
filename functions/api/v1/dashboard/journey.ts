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
}

/**
 * First non-completed level of the user's track; undefined when nothing has
 * been started yet, "done" when rows exist but all are completed.
 */
async function findCurrentLevelId(
  supabase: SupabaseClient,
  userId: string,
  pathIds: string[],
): Promise<{ levelId?: string; done: boolean }> {
  const { data: rows } = await supabase
    .from("user_capability_level_progress")
    .select("level_id, status")
    .eq("user_id", userId)
    .in("learning_path_id", pathIds)
    .order("sequence_no", { ascending: true });

  if (!rows || rows.length === 0) return { done: false };
  const open = rows.find((r) => r.status !== "completed");
  return open ? { levelId: open.level_id, done: false } : { done: true };
}

/** Title of the current module's first artifact question, or null. */
async function findArtifactOutput(
  supabase: SupabaseClient,
  moduleId: string,
): Promise<string | null> {
  const { data: contentRows } = await supabase
    .from("modules_content")
    .select("id")
    .eq("module_id", moduleId);
  const contentIds = (contentRows ?? []).map((r: { id: string }) => r.id);
  if (contentIds.length === 0) return null;

  const { data: artifactRows } = await supabase
    .from("module_artifacts")
    .select("id")
    .in("modules_content_id", contentIds)
    .eq("is_active", true);
  const artifactIds = (artifactRows ?? []).map((r: { id: string }) => r.id);
  if (artifactIds.length === 0) return null;

  const { data: question } = await supabase
    .from("artifact_questions")
    .select("title")
    .in("artifact_id", artifactIds)
    .eq("is_active", true)
    .order("question_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return question?.title ?? null;
}

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireAuth(context.request, context.env);
    const supabase = createServiceSupabase(context.env);

    const track = await getActiveLearningTrack(supabase, user.sub);
    let levelId: string | undefined;
    if (track && track.roles.length > 0) {
      const pathIds = track.roles.map((r) => r.learningPathId);
      const { levelId: openLevelId, done } = await findCurrentLevelId(supabase, user.sub, pathIds);
      if (openLevelId) {
        levelId = openLevelId;
      } else if (!done) {
        // nothing started yet: point at the first level of the track's first capability
        const firstRole = track.roles[0];
        if (!firstRole) {
          return jsonResponse<DashboardJourneyResponse>({ success: true, data: null });
        }
        const capabilities = await getCapabilitiesByRoleId(supabase, firstRole.roleId);
        const firstCapability = capabilities[0];
        const levels = firstCapability
          ? await getLevelsForCapability(supabase, firstCapability.id)
          : [];
        levelId = levels[0]?.id;
      }
    }

    if (!levelId) {
      return jsonResponse<DashboardJourneyResponse>({ success: true, data: null });
    }

    const details = await getLevelWithModules(supabase, levelId, user.sub);
    if (!details || details.modules.length === 0) {
      return jsonResponse<DashboardJourneyResponse>({ success: true, data: null });
    }

    const current =
      details.modules.find((m) => !m.isCompleted) ?? details.modules[details.modules.length - 1];
    if (!current) {
      return jsonResponse<DashboardJourneyResponse>({ success: true, data: null });
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
