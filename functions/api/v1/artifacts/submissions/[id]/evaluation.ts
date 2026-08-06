import type { AIDebugTelemetry } from "@functions/lib/ai-engine/types";
import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { ArtifactSubmissionError, getSubmissionEvaluationFlow } from "../../queries";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  const submissionId = context.params["id"];

  if (!submissionId) {
    return jsonError("Submission ID is required.", 400, {
      code: "SUBMISSION_ID_REQUIRED",
      requestId,
    });
  }

  try {
    const user = await requireAuth(context.request, context.env);
    const supabase = createServiceSupabase(context.env);
    const flow = await getSubmissionEvaluationFlow(supabase, submissionId, user.sub);
    const meta = flow?.metadata as Record<string, unknown> | null;

    return jsonResponse({
      success: true,
      evaluation: flow
        ? {
            id: flow.id,
            submission_id: flow.submission_id,
            stage: flow.stage,
            status: flow.status,
            score: flow.score,
            decision: flow.decision,
            feedback: flow.feedback,
            improvements: flow.improvements,
            completed_at: flow.completed_at,
            rubric_rows: meta?.["rubric_rows"] ?? [],
            calculated_xp: meta?.["calculated_xp"] ?? 0,
            debug_telemetry: (meta?.["debug_telemetry"] as AIDebugTelemetry | undefined) ?? null,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.code === "UNAUTHORIZED" ? 401 : 403, {
        code: error.code,
        requestId,
      });
    }
    if (error instanceof ArtifactSubmissionError) {
      return jsonError(error.message, error.status, { code: error.code, requestId });
    }

    apiLogger.error("Failed to fetch submission evaluation flow", error, { requestId });
    return jsonError("Failed to fetch evaluation.", 500, { code: "SERVER_ERROR", requestId });
  }
}
