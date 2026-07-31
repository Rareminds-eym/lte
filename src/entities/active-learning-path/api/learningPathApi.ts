import { z } from "zod";
import { ApiError, apiFetch } from "@/shared/api";
import type { ActiveLearningPath } from "@/shared/types/auth";

const ActiveLearningPathResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .object({
      learningPathId: z.string(),
      learningTrackId: z.string(),
      roleId: z.string(),
      track: z.string(),
      fit: z.string(),
      matchScore: z.number(),
    })
    .nullable(),
});

/**
 * Fetch the active learning path for the authenticated user.
 * Token authorization is implicitly handled by the shared apiFetch client.
 */
export async function fetchActiveLearningPath(): Promise<ActiveLearningPath | null> {
  const raw = await apiFetch("/api/v1/learning-paths/active", {
    method: "GET",
  });

  const parsed = ActiveLearningPathResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("Invalid response format from server");
  }

  return parsed.data.data;
}
