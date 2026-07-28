import { useMutation } from "@tanstack/react-query";
import { InitializeLearningPathError, initializeLearningPath } from "../api/initializeLearningPath";
import type { InitializeLearningPathPayload } from "./initializeLearningPath.schema";

export const useInitializeLearningPath = () => {
  return useMutation({
    mutationFn: ({
      payload,
      accessToken,
    }: {
      payload: InitializeLearningPathPayload;
      accessToken: string;
    }) =>
      initializeLearningPath({
        payload,
        accessToken,
      }),

    retry: (failureCount, error) => {
      // Do not retry on aborted requests
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        return false;
      }

      // Do not retry on client-side errors (400-499)
      if (
        error instanceof InitializeLearningPathError &&
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
