import { z } from "zod";

export const InitializeLearningPathSchema = z.object({
  fit: z.enum(["High", "Medium", "Explore"], {
    message: "fit must be one of 'High', 'Medium', 'Explore'",
  }),
  track: z.string().trim().min(1, "track is required"),
  matchScore: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const num = Number(val);
      if (Number.isNaN(num)) {
        throw new Error("matchScore must be a number or numeric string");
      }
      return num;
    })
    .pipe(z.number().min(0).max(100)),
  whyItFits: z
    .string()
    .trim()
    .optional()
    .transform((val) => val ?? ""),
  attemptId: z.string().uuid("attemptId must be a valid UUID"),
  roleId: z.string().uuid("roleId must be a valid UUID"),
});

export type InitializeLearningPathRequest = z.infer<typeof InitializeLearningPathSchema>;
