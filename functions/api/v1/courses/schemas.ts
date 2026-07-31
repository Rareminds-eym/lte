import { z } from "zod";

export const LevelIdParamsSchema = z.object({
  levelId: z.string().min(1, "Level id is required"),
});

export const LevelModuleParamsSchema = z.object({
  levelId: z.string().min(1, "Level id is required"),
  moduleNo: z.string().regex(/^\d+$/, "Module number must be an integer"),
});
