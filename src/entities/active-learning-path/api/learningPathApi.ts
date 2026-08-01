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
      track: z
        .string()
        .nullish()
        .transform((v) => v ?? ""),
      fit: z
        .string()
        .nullish()
        .transform((v) => v ?? ""),
      matchScore: z
        .number()
        .nullish()
        .transform((v) => v ?? 0),
    })
    .nullable(),
});

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
