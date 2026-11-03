import { z } from "zod";

export const completedLevelSchema = z.object({
  id: z.uuid(),
  level_id: z.uuid(),
  learning_path_id: z.uuid(),
  status: z.string(),
  completed_at: z.iso.datetime({ offset: true }).nullable(),
  badge: z.string().nullable(),
});
export const completedPathSchema = z.object({
  id: z.uuid(),
  role_id: z.uuid(),
  learning_track_id: z.uuid(),
  status: z.string(),
  completed_at: z.iso.datetime({ offset: true }).nullable(),
  badge: z.string().nullable(),
  role_readiness_percentage: z.number().min(0).max(100),
});
export const levelSchema = z.object({
  title: z.string(),
  level_code: z.string(),
  duration_minutes: z.number().nonnegative(),
  capabilities: z.object({ code: z.string(), name: z.string() }),
  level_scale: z.object({ level_no: z.number().int().positive() }),
});
