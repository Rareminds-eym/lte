import { z } from "zod";

export const initializeLearningPathSchema = z.object({
  fit: z.string().trim().min(1),
  track: z.string().trim().min(1),
  matchScore: z.coerce.number().finite().min(0).max(100),
  whyItFits: z.string().trim().default(""),
  attemptId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export type InitializeLearningPathPayload = z.infer<typeof initializeLearningPathSchema>;
