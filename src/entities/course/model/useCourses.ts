import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api";
import { fetchUserCourses } from "../api/courseApi";

export const useCourses = (userId?: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["userCourses", userId],
    queryFn: () => fetchUserCourses(),
    enabled: typeof userId === "string" && userId.trim() !== "" && options?.enabled !== false,
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      const status =
        error instanceof ApiError
          ? error.status
          : typeof (error as { status?: unknown })?.status === "number"
            ? (error as unknown as { status: number }).status
            : undefined;

      // Do not retry hard client errors (400, 404, etc.), but allow 1 retry for 401/403 in case token is refreshing
      if (
        typeof status === "number" &&
        status >= 400 &&
        status < 500 &&
        status !== 401 &&
        status !== 403
      ) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 4_000),
  });
};
