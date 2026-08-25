import type { z } from "zod";
import { apiGet } from "@/shared/api";
import {
  LevelDetailsPayloadSchema,
  ModuleDetailsPayloadSchema,
} from "../model/levelContentSchemas";
import type { LevelDetailsResponse, ModuleDetailsResponse } from "../model/levelContentTypes";

type LevelDetailsPayload = z.infer<typeof LevelDetailsPayloadSchema>;
type ModuleDetailsPayload = z.infer<typeof ModuleDetailsPayloadSchema>;

const LEVEL_API_BASE = "/api/v1/courses";

export async function fetchLevelDetails(
  levelId: string,
  capabilityCode?: string,
  signal?: AbortSignal,
): Promise<LevelDetailsResponse> {
  const url = capabilityCode
    ? `${LEVEL_API_BASE}/${encodeURIComponent(capabilityCode)}/levels/${encodeURIComponent(levelId)}`
    : `${LEVEL_API_BASE}/${encodeURIComponent(levelId)}`;
  const payload = await apiGet<LevelDetailsPayload>(url, { signal });
  try {
    const parsedPayload = LevelDetailsPayloadSchema.parse(payload);
    return parsedPayload.level;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Schema validation failed: ${error.message}`);
    }
    throw error;
  }
}

export async function fetchLevelModuleDetails(
  levelId: string,
  moduleNo: number,
  signal?: AbortSignal,
): Promise<ModuleDetailsResponse> {
  const payload = await apiGet<ModuleDetailsPayload>(
    `${LEVEL_API_BASE}/${encodeURIComponent(levelId)}/modules/${moduleNo}`,
    { signal },
  );
  const parsedPayload = ModuleDetailsPayloadSchema.parse(payload);
  return parsedPayload.module;
}
