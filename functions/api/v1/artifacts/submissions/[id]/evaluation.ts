import { jsonError, jsonResponse } from "@functions/lib/http";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { uuidSchema } from "@functions/schemas";
import { apiLogger } from "@functions/shared/logger";
import { ArtifactSubmissionError, getSubmissionEvaluationFlow } from "../../queries";

export async function onRequestGet(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  const submissionId = context.params["id"];

  const parsedId = uuidSchema.safeParse(submissionId);
  if (!parsedId.success) {
    return jsonError("Submission ID must be a valid UUID.", 400, {
      code: "INVALID_SUBMISSION_ID",
      requestId,
    });
  }
  const validSubmissionId = parsedId.data;

  try {
    const user = context.data?.["user"] as { sub: string } | undefined;
    if (!user) {
      return jsonError("Unauthorized", 401, { code: "UNAUTHORIZED", requestId });
    }
    const supabase = createServiceSupabase(context.env);
    const flow = await getSubmissionEvaluationFlow(supabase, validSubmissionId, user.sub);
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
            confidence: (meta?.["confidence"] as number | null) ?? null,
            decision: flow.decision,
            feedback: flow.feedback,
            improvements: flow.improvements,
            completed_at: flow.completed_at,
            rubric_rows: meta?.["rubric_rows"] ?? [],
            calculated_xp: meta?.["calculated_xp"] ?? 0,
            debug_telemetry: meta?.["debug_telemetry"] ?? null,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof ArtifactSubmissionError) {
      return jsonError(error.message, error.status, { code: error.code, requestId });
    }

    apiLogger.error("Failed to fetch submission evaluation flow", error, { requestId });
    return jsonError("Failed to fetch evaluation.", 500, { code: "SERVER_ERROR", requestId });
  }
}
