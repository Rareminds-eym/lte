import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_QUERY_KEY } from "@/entities/dashboard";
import { startLevelProgress, startModuleProgress, updateStageProgress } from "../api/progressApi";
import {
  LEVEL_CONTENT_QUERY_KEY,
  LEVEL_DETAILS_QUERY_KEY,
  LEVEL_MODULE_DETAILS_QUERY_KEY,
} from "./useLevelContentData";

export const useStartLevelProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (levelId: string) => startLevelProgress(levelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCourses"] });
      queryClient.invalidateQueries({ queryKey: ["capabilityLevels"] });
      queryClient.invalidateQueries({ queryKey: [LEVEL_DETAILS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    },
  });
};

export const useStartModuleProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { levelId: string; moduleNo: number }) =>
      startModuleProgress(params.levelId, params.moduleNo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCourses"] });
      // Invalidate level queries via prefix (covers userId-partitioned keys)
      queryClient.invalidateQueries({ queryKey: [LEVEL_DETAILS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEVEL_MODULE_DETAILS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEVEL_CONTENT_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    },
  });
};

export const useUpdateStageProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      levelId: string;
      moduleNo: number;
      eContentId: string;
      stageName: string;
      status: "in_progress" | "completed";
      durationSeconds?: number;
    }) =>
      updateStageProgress(
        params.levelId,
        params.moduleNo,
        params.eContentId,
        params.stageName,
        params.status,
        params.durationSeconds,
      ),
    onSuccess: () => {
      // Invalidate user courses list to reflect overall progress updates
      queryClient.invalidateQueries({ queryKey: ["userCourses"] });
      // Invalidate level queries via prefix (covers userId-partitioned keys)
      queryClient.invalidateQueries({ queryKey: [LEVEL_DETAILS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEVEL_MODULE_DETAILS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEVEL_CONTENT_QUERY_KEY] });
      // Invalidate course capability levels to update course progress percentage
      queryClient.invalidateQueries({ queryKey: ["capabilityLevels"] });
      // Invalidate dashboard journey so Continue Your Journey follows the last touch
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    },
  });
};
