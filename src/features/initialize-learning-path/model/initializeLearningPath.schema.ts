import { z } from "zod";

export const initializeLearningPathSchema = z.object({
  fit: z.enum(["High", "Medium", "Explore"], {
    message: "fit must be one of 'High', 'Medium', 'Explore'",
  }),
  track: z.string().trim().min(1, "track is required"),
  matchScore: z
    .union([z.number(), z.string()])
    .refine((val) => !Number.isNaN(Number(val)), {
      message: "matchScore must be a number or numeric string",
    })
    .transform((val) => Number(val))
    .pipe(z.number().min(0).max(100)),
  whyItFits: z
    .string()
    .trim()
    .optional()
    .transform((val) => val ?? ""),
  attemptId: z.string().uuid("attemptId must be a valid UUID"),
  roleId: z.string().uuid("roleId must be a valid UUID"),
  duration: z
    .string()
    .trim()
    .optional()
    .transform((val) => val ?? "6 months"),
});

export type InitializeLearningPathPayload = z.infer<typeof initializeLearningPathSchema>;
