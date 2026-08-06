import { AuthError, requireAuth } from "@functions/lib/auth";
import { jsonError, jsonResponse, readJsonObject } from "@functions/lib/http";
import { apiLogger } from "@functions/lib/logger";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { ArtifactSubmissionError, submitArtifactSubmission } from "../queries";
import { completeSubmissionSchema } from "../schemas";

async function readSubmissionPayload(request: Request): Promise<{
  body: Record<string, unknown>;
  filesByQuestionId: Map<string, File>;
}> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return { body: await readJsonObject(request), filesByQuestionId: new Map() };
  }

  const formData = await request.formData();
  const payload = formData.get("payload");
  if (typeof payload !== "string") {
    throw new ArtifactSubmissionError("Submission payload is required.", 400, "PAYLOAD_REQUIRED");
  }

  const filesByQuestionId = new Map<string, File>();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("file:") && value instanceof File) {
      filesByQuestionId.set(key.slice("file:".length), value);
    }
  }

  return { body: JSON.parse(payload) as Record<string, unknown>, filesByQuestionId };
}

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    const user = await requireAuth(context.request, context.env);
    const { body, filesByQuestionId } = await readSubmissionPayload(context.request);
    const parsed = completeSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid submission request", 400, {
        code: "VALIDATION_ERROR",
        requestId,
      });
    }

    const supabase = createServiceSupabase(context.env);
    const result = await submitArtifactSubmission(
      supabase,
      context.env,
      user.sub,
      parsed.data,
      filesByQuestionId,
    );
    return jsonResponse({ success: true, ...result });
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

    apiLogger.error("Failed to submit artifact", error, { requestId });
    return jsonError("Failed to submit artifact.", 500, {
      code: "SERVER_ERROR",
      requestId,
    });
  }
}
