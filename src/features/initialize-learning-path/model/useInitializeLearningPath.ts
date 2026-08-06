import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_QUERY_KEY } from "@/entities/dashboard/model/useDashboardData";
import { ApiError } from "@/shared";
import { initializeLearningPath } from "../api/initializeLearningPath";
import type { InitializeLearningPathPayload } from "./initializeLearningPath.schema";

export const useInitializeLearningPath = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload }: { payload: InitializeLearningPathPayload }) =>
      initializeLearningPath({
        payload,
      }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCourses"] });
      queryClient.invalidateQueries({ queryKey: ["activeLearningPath"] });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      // Purge any stale/errored levels queries so they refetch against the
      // newly-created learning path (prevents lingering 404 cache entries).
      queryClient.invalidateQueries({ queryKey: ["capabilityLevels"] });
    },

    retry: (failureCount, error) => {
      // Do not retry on aborted requests
      if (error instanceof DOMException && error.code === 20) {
        return false;
      }
      if (error instanceof Error && error.name === "AbortError") {
        return false;
      }

      // Do not retry on client-side errors (400-499)
      if (
        error instanceof ApiError &&
        error.status !== undefined &&
        error.status >= 400 &&
        error.status < 500
      ) {
        return false;
      }

      // Retry up to 2 times for network/server errors (total 3 attempts)
      return failureCount < 2;
    },

    retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 4_000),
  });
};
