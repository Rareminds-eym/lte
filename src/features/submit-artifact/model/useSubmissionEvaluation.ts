import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthStore } from "@/entities/session";
import { REVIEW_POLLING_INTERVAL_MS } from "@/shared/config";
import { getSubmissionEvaluation } from "../api";

/**
 * Server-state query for a submission's stored evaluation flow. The query key
 * includes the user ID so the cache is partitioned per user and invalidates
 * automatically when the active session changes.
 */
export const useSubmissionEvaluation = (submissionId: string | undefined) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["submission-evaluation", userId, submissionId],
    queryFn: ({ signal }) => getSubmissionEvaluation(submissionId as string, signal),
    enabled: Boolean(userId && submissionId),
    staleTime: 30_000,
    refetchOnReconnect: true,
    refetchInterval: (query) => {
      const response = query.state.data;
      const pending =
        response?.evaluation?.decision === "human_review" ||
        response?.stages?.some((stage) =>
          ["unassigned", "pending", "in_progress"].includes(stage.status),
        );
      return pending ? REVIEW_POLLING_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: false,
  });
  const completedAt = query.data?.stages?.find(
    (stage) => stage.stage === "staff_review" && stage.status === "completed",
  )?.completed_at;
  useEffect(() => {
    if (!completedAt || !userId) return;
    for (const prefix of [
      "userCourses",
      "capabilityLevels",
      "levelContent",
      "levelModuleDetails",
      "levelDetails",
      "dashboardData",
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  }, [completedAt, userId, submissionId, queryClient]);
  return query;
};
