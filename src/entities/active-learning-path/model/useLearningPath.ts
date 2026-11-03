import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import { queryClient } from "@/shared/lib";
import type { ActiveTrackDetail } from "@/shared/types/auth";
import { toast } from "@/shared/ui";
import { activateLearningTrack, fetchActiveLearningPath } from "../api/learningPathApi";

export const learningPathKey = (userId: string) => ["activeLearningPath", userId] as const;
const options = (userId: string) => ({
  queryKey: learningPathKey(userId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchActiveLearningPath(false, signal),
});
/** Used by session bootstrap and assessment completion; TanStack owns the data and errors. */
export const loadLearningPath = (userId: string) =>
  queryClient.fetchQuery({ ...options(userId), staleTime: 0 });
export const clearLearningPath = () =>
  queryClient.removeQueries({ queryKey: ["activeLearningPath"] });

interface LearningPathState {
  activeTrack: ActiveTrackDetail | null;
  activeLearningPathLoading: boolean;
  needsAssessment: boolean;
  error: string | null;
  fetchAndSetActiveLearningPath: (userId: string, options?: { refresh?: boolean }) => Promise<void>;
  switchActiveTrack: (trackId: string) => Promise<void>;
}
/** A selector over query/mutation state, with no mirrored Zustand cache. */
export function useLearningPath<T>(select: (state: LearningPathState) => T): T {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const client = useQueryClient();
  const query = useQuery({ ...options(userId ?? ""), enabled: Boolean(userId) });
  const mutationKey = ["changeLearningPath", userId];
  const changing = useIsMutating({ mutationKey });
  const mutation = useMutation({
    mutationKey,
    mutationFn: async (command: { trackId?: string; refresh?: boolean }) => {
      if (!userId) throw new Error("Authentication required");
      await client.cancelQueries({ queryKey: learningPathKey(userId) });
      if (useAuthStore.getState().user?.id !== userId) throw new Error("Session changed");
      if (command.trackId) await activateLearningTrack(command.trackId);
      return fetchActiveLearningPath(command.refresh ?? false);
    },
    onSuccess: async (data) => {
      if (!userId || useAuthStore.getState().user?.id !== userId) return;
      client.setQueryData(learningPathKey(userId), data);
      await Promise.all(
        ["dashboardData", "userCourses", "capabilityLevels"].map((prefix) =>
          client.invalidateQueries({ queryKey: [prefix, userId] }),
        ),
      );
    },
  });
  return select({
    activeTrack: query.data?.data ?? null,
    needsAssessment: query.data?.needsAssessment ?? false,
    activeLearningPathLoading:
      Boolean(userId) && (query.isPending || query.isFetching || changing > 0),
    error: query.error?.message ?? mutation.error?.message ?? null,
    fetchAndSetActiveLearningPath: async (requestedUserId, command) => {
      if (requestedUserId !== userId) return;
      await mutation.mutateAsync({ refresh: command?.refresh }).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Unable to refresh learning path");
      });
    },
    switchActiveTrack: async (trackId) => {
      await mutation.mutateAsync({ trackId });
    },
  });
}
