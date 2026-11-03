import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import { REVIEW_POLLING_INTERVAL_MS } from "@/shared/config";
import { fetchDashboardData } from "../api/dashboardApi";
import type { DashboardData } from "./types";

// Prefix used by invalidators; the active query key is partitioned per user so
// the cache never serves one user's XP/journey to another.
export const DASHBOARD_QUERY_KEY = ["dashboardData"];

export const useDashboardData = () => {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<DashboardData>({
    queryKey: [...DASHBOARD_QUERY_KEY, userId],
    queryFn: ({ signal }) => fetchDashboardData(signal),
    enabled: Boolean(userId),
    refetchOnReconnect: true,
    refetchInterval: (query) =>
      query.state.data?.upcomingFeedback.upcoming.length || query.state.data?.upcomingFeedback.error
        ? REVIEW_POLLING_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
    staleTime: 1000 * 60 * 2, // 2 minutes cache policy
    refetchOnWindowFocus: false, // matches global policy, avoiding focus-refetching
  });
};
