import { requireAuth } from "@functions/lib/auth";
import { jsonResponse, readJsonObject } from "@functions/lib/http";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import {
  checkRoleExists,
  deactivateOtherPaths,
  upsertLearningPath,
  upsertLearningTrack,
} from "./queries";
import { InitializeLearningPathSchema } from "./schemas";

export async function onRequestPost(context: PagesContext<LteEnv>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    // 1. Authenticate user using JWT
    const user = await requireAuth(context.request, context.env);
    const userId = user.sub;

    // 2. Read and parse request body using Zod validation
    let rawBody: Record<string, unknown>;
    try {
      rawBody = await readJsonObject(context.request);
    } catch {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Request body must be a valid JSON object",
            details: {},
          },
          requestId,
        },
        { status: 400 },
      );
    }

    const parsedBody = InitializeLearningPathSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      const details = parsedBody.error.flatten().fieldErrors;
      return jsonResponse(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsedBody.error.issues[0]?.message ?? "Invalid request body",
            details,
          },
          requestId,
        },
        { status: 400 },
      );
    }

    const { fit, track, matchScore, whyItFits, attemptId, roleId } = parsedBody.data;

    // 3. Initialize Supabase Client
    const supabase = createServiceSupabase(context.env);

    // 4. Validate that the target role exists in the public.roles shadow table
    const roleExists = await checkRoleExists(supabase, roleId);
    if (!roleExists) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "ROLE_NOT_FOUND",
            message: `Target role context '${roleId}' does not exist in local database.`,
            details: {},
          },
          requestId,
        },
        { status: 400 },
      );
    }

    // 5. Execute database queries
    // First, upsert learning track
    const trackId = await upsertLearningTrack(supabase, {
      userId,
      attemptId,
      fit,
      track,
      matchScore,
      whyItFits,
    });

    // Next, deactivate other active learning paths for this user (enforcing active path constraint)
    await deactivateOtherPaths(supabase, userId);

    // Finally, upsert the learning path for this track
    const pathId = await upsertLearningPath(supabase, {
      userId,
      trackId,
      roleId,
    });

    return jsonResponse(
      {
        success: true,
        learningTrackId: trackId,
        learningPathId: pathId,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";

    // Handle authentication / permission errors
    if (
      message.includes("bearer token") ||
      message.includes("Unauthenticated") ||
      message.includes("access is required")
    ) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message,
            details: {},
          },
          requestId,
        },
        { status: 401 },
      );
    }

    // Fallback error for other issues
    return jsonResponse(
      {
        success: false,
        error: {
          code: "SERVER_ERROR",
          message,
          details: {},
        },
        requestId,
      },
      { status: 500 },
    );
  }
}
