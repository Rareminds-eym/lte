import { z } from "zod";

export const GetCapabilitiesRequestSchema = z.object({
  roleId: z.string().trim().min(1, "roleId is required"),
});

export const CapabilityCodeParamsSchema = z.object({
  capabilityCode: z.string().trim().min(1, "capabilityCode is required"),
});
