import { apiFetch } from "@/shared/api";

export interface LevelProgressResponse {
  success: boolean;
  levelProgressId: string;
}

export interface ModuleProgressResponse {
  success: boolean;
  moduleProgressId: string;
}

export interface StageProgressResponse {
  success: boolean;
  stageProgressId: string;
  stagesCompleted: number;
  completionPercentage: number;
  xpAwarded?: number;
  totalXp?: number;
  xpCategory?: "evidence" | "engagement";
  levelCompleted?: boolean;
  levelXpAwarded?: number;
}

export async function startLevelProgress(levelId: string): Promise<LevelProgressResponse> {
  return apiFetch<LevelProgressResponse>(
    `/api/v1/courses/${encodeURIComponent(levelId)}/progress`,
    {
      method: "POST",
      body: JSON.stringify({ status: "in_progress" }),
    },
  );
}

export async function startModuleProgress(
  levelId: string,
  moduleNo: number,
): Promise<ModuleProgressResponse> {
  return apiFetch<ModuleProgressResponse>(
    `/api/v1/courses/${encodeURIComponent(levelId)}/modules/${moduleNo}/progress`,
    {
      method: "POST",
      body: JSON.stringify({ status: "in_progress" }),
    },
  );
}

export async function updateStageProgress(
  levelId: string,
  moduleNo: number,
  eContentId: string,
  stageName: string,
  status: "in_progress" | "completed",
  durationSeconds?: number,
  options: Pick<RequestInit, "keepalive"> = {},
): Promise<StageProgressResponse> {
  return apiFetch<StageProgressResponse>(
    `/api/v1/courses/${encodeURIComponent(levelId)}/modules/${moduleNo}/stages/progress`,
    {
      method: "POST",
      ...options,
      body: JSON.stringify({
        eContentId,
        stageName,
        status,
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      }),
    },
  );
}
