import { useQuery } from "@tanstack/react-query";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { useAuthStore } from "@/entities/session";
import { fetchCapabilityLevels } from "../api/courseApi";

/**
 * Fetches capability levels for a given capability code.
 *
 * Gated on the active learning path being available in the store.
 * The backend `/api/v1/capabilities/:code/levels` endpoint requires an active
 * learning path to resolve capability levels — it returns 404 without one.
 *
 * During the SkillPassport → LTE transition, the learning path is created by
 * `LearningPathInitializer`. This dependent-query pattern (TanStack Query
 * recommended) prevents a premature 404 by deferring the fetch until the
 * learning path is confirmed active.
 */
export const useCapabilityLevels = (capabilityCode: string) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeTrack = useLearningPathStore((s) => s.activeTrack);
  const activeLearningPathLoading = useLearningPathStore((s) => s.activeLearningPathLoading);

  // Wait for auth + active learning track before firing the levels query.
  const hasAuth = isAuthenticated;
  const learningPathReady = Boolean(activeTrack) && !activeLearningPathLoading;

  return useQuery({
    queryKey: ["capabilityLevels", capabilityCode],
    queryFn: () => fetchCapabilityLevels(capabilityCode),
    enabled: Boolean(capabilityCode) && hasAuth && learningPathReady,
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
  });
};
