import { useQuery } from "@tanstack/react-query";
import { fetchUserCourses } from "../api/courseApi";

export const useCourses = () => {
  return useQuery({
    queryKey: ["userCourses"],
    queryFn: () => fetchUserCourses(),
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error) => {
      if (
        error instanceof Error &&
        "status" in error &&
        typeof (error as { status: unknown }).status === "number" &&
        (error as { status: number }).status >= 400 &&
        (error as { status: number }).status < 500
      ) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 4_000),
  });
};
