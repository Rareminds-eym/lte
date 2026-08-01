import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startLevelProgress, startModuleProgress, updateStageProgress } from "../api/progressApi";

export const useStartLevelProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (levelId: string) => startLevelProgress(levelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCourses"] });
      queryClient.invalidateQueries({ queryKey: ["capabilityLevels"] });
      queryClient.invalidateQueries({ queryKey: ["levelDetails"] });
    },
  });
};

export const useStartModuleProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { levelId: string; moduleNo: number }) =>
      startModuleProgress(params.levelId, params.moduleNo),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["userCourses"] });
      queryClient.invalidateQueries({
        queryKey: ["levelContent", variables.levelId, variables.moduleNo],
      });
      queryClient.invalidateQueries({ queryKey: ["levelDetails", variables.levelId] });
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
    }) =>
      updateStageProgress(
        params.levelId,
        params.moduleNo,
        params.eContentId,
        params.stageName,
        params.status,
      ),
    onSuccess: (_, variables) => {
      // Invalidate user courses list to reflect overall progress updates
      queryClient.invalidateQueries({ queryKey: ["userCourses"] });
      // Invalidate module level content
      queryClient.invalidateQueries({
        queryKey: ["levelContent", variables.levelId, variables.moduleNo],
      });
      // Invalidate level details (includes progressPercentage recalculation)
      queryClient.invalidateQueries({
        queryKey: ["levelDetails"],
      });
      // Invalidate course capability levels to update course progress percentage
      queryClient.invalidateQueries({ queryKey: ["capabilityLevels"] });
    },
  });
};
