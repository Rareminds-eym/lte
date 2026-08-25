import { z } from "zod";

export const LevelIdParamsSchema = z.object({
  levelId: z.string().min(1, "Level id is required"),
});

export const CapabilityLevelParamsSchema = z.object({
  capabilityCode: z.string().optional(),
  capabilityId: z.string().optional(),
  levelId: z.string().min(1, "Level id is required"),
});

export const LevelModuleParamsSchema = z.object({
  levelId: z.string().min(1, "Level id is required"),
  moduleNo: z.string().regex(/^\d+$/, "Module number must be an integer"),
});
