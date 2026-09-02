import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/ApiError";
import { getLogger } from "../config/logging";

const logger = getLogger("QueryClient");

/**
 * Global retry policy: never retry aborted requests or 4xx client errors;
 * retry network dropouts / 5xx exactly once.
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  // Do not retry on aborted requests
  if (error instanceof DOMException && error.code === 20) return false;
  if (error instanceof Error && error.name === "AbortError") return false;

  // Do not retry 4xx client errors (400, 401, 403, 404, 422)
  if (
    error instanceof ApiError &&
    error.status !== undefined &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false;
  }

  // Retry network dropouts / 5xx errors once
  return failureCount < 1;
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error(
        `Query Failed [${JSON.stringify(query.queryKey.map((v) => (typeof v === "string" && /^[0-9a-f-]{20,}$/i.test(v) ? "[redacted]" : v)))}]`,
        error,
      );
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      logger.error(
        `Mutation Failed [${mutation.options.mutationKey ? JSON.stringify((mutation.options.mutationKey as unknown[]).map((v) => (typeof v === "string" && /^[0-9a-f-]{20,}$/i.test(v) ? "[redacted]" : v))) : "unnamed"}]`,
        error,
      );
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 4000),
      networkMode: "offlineFirst" as const,
      throwOnError: false,
      structuralSharing: true,
    },
    mutations: {
      retry: false,
    },
  },
});
