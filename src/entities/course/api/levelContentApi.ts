import { apiGet } from "@/shared/api";
import {
  LevelDetailsPayloadSchema,
  ModuleDetailsPayloadSchema,
} from "../model/levelContentSchemas";
import type { LevelDetailsResponse, ModuleDetailsResponse } from "../model/levelContentTypes";

const LEVEL_API_BASE = "/api/v1/courses";

export async function fetchLevelDetails(
  levelId: string,
  capabilityCode?: string,
): Promise<LevelDetailsResponse> {
  const url = capabilityCode
    ? `${LEVEL_API_BASE}/${encodeURIComponent(capabilityCode)}/levels/${encodeURIComponent(levelId)}`
    : `${LEVEL_API_BASE}/${encodeURIComponent(levelId)}`;
  const payload = await apiGet<unknown>(url);
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
): Promise<ModuleDetailsResponse> {
  const payload = await apiGet<unknown>(
    `${LEVEL_API_BASE}/${encodeURIComponent(levelId)}/modules/${moduleNo}`,
  );
  const parsedPayload = ModuleDetailsPayloadSchema.parse(payload);
  return parsedPayload.module;
}
