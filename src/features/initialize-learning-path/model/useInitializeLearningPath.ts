import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/shared/api";
import { initializeLearningPath } from "../api/initializeLearningPath";
import type { InitializeLearningPathPayload } from "./initializeLearningPath.schema";

export const useInitializeLearningPath = () => {
  return useMutation({
    mutationFn: ({ payload }: { payload: InitializeLearningPathPayload }) =>
      initializeLearningPath({
        payload,
      }),

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
