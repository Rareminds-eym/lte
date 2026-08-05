import { z } from "zod";

export const initializeLearningPathSchema = z.object({
  trackId: z.string().uuid("trackId must be a valid UUID"),
});

export type InitializeLearningPathPayload = z.infer<typeof initializeLearningPathSchema>;
