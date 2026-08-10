import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import { getSubmissionEvaluation } from "../api";

/**
 * Server-state query for a submission's stored evaluation flow. The query key
 * includes the user ID so the cache is partitioned per user and invalidates
 * automatically when the active session changes.
 */
export const useSubmissionEvaluation = (submissionId: string | undefined) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: ["submission-evaluation", userId, submissionId],
    queryFn: () => getSubmissionEvaluation(submissionId as string),
    enabled: Boolean(userId && submissionId),
    staleTime: 30_000,
    retry: 1,
  });
};
