import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import { fetchUserCourses } from "../api/courseApi";

export const useCourses = () => {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ["userCourses", accessToken],
    queryFn: ({ queryKey }) => fetchUserCourses(queryKey[1] as string),
    enabled: !!accessToken,
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
