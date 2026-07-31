import { z } from "zod";
import { ApiError } from "@/shared";
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

export async function fetchActiveLearningPath(
  accessToken: string,
): Promise<ActiveLearningPath | null> {
  const response = await fetch("/api/v1/learning-paths/active", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData: { error?: { message?: string } } | null = await response
      .json()
      .catch(() => null);
    throw new ApiError(
      errorData?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }

  const raw = await response.json();
  const parsed = ActiveLearningPathResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("Invalid response format from server");
  }

  return parsed.data.data;
}
