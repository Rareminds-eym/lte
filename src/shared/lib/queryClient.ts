import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/ApiError";
import { getLogger } from "../config/logging";

const logger = getLogger("QueryClient");

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error(`Query Failed [${JSON.stringify(query.queryKey)}]`, error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      logger.error(
        `Mutation Failed [${mutation.options.mutationKey ? JSON.stringify(mutation.options.mutationKey) : "unnamed"}]`,
        error,
      );
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
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
      },
    },
  },
});
