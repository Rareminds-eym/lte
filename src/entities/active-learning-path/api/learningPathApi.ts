import { z } from "zod";
import { ApiError, apiFetch } from "@/shared/api";
import type { ActiveTrackDetail } from "@/shared/types/auth";

const ActiveTrackRoleSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  learningPathId: z.string(),
  readinessScore: z.number().optional().default(0),
  status: z.string().optional().default("not_started"),
  updatedAt: z.string().nullable().default(null),
});

const CareerTrackItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  matchPercentage: z.number().optional(),
  isExplore: z.boolean().optional(),
  isSelected: z.boolean().optional(),
  fit: z.string().optional(),
});

const ActiveTrackDetailSchema = z.object({
  learningTrackId: z.string(),
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
  whyItFits: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  roles: z.array(ActiveTrackRoleSchema),
  tracks: z.array(CareerTrackItemSchema).optional(),
  overallProgress: z.number().optional(),
  completionCount: z.number().optional(),
});

const ActiveLearningPathResponseSchema = z.object({
  success: z.literal(true),
  needsAssessment: z.boolean().optional(),
  data: ActiveTrackDetailSchema.nullable(),
});

export interface ActiveLearningPathResult {
  data: ActiveTrackDetail | null;
  needsAssessment: boolean;
}

export async function fetchActiveLearningPath(): Promise<ActiveLearningPathResult> {
  const raw = await apiFetch("/api/v1/learning-paths/active", {
    method: "GET",
  });

  const parsed = ActiveLearningPathResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("Invalid response format from server");
  }

  return {
    data: parsed.data.data,
    needsAssessment: parsed.data.needsAssessment ?? false,
  };
}

export async function activateLearningTrack(trackId: string): Promise<void> {
  await apiFetch("/api/v1/learning-paths/active-track", {
    method: "PATCH",
    body: JSON.stringify({ trackId }),
  });
}
