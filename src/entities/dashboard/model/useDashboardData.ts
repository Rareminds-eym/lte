import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/session";
import { fetchDashboardData } from "../api/dashboardApi";
import type { DashboardData } from "./types";

// Prefix used by invalidators; the active query key is partitioned per user so
// the cache never serves one user's XP/journey to another.
export const DASHBOARD_QUERY_KEY = ["dashboardData"];

export const useDashboardData = () => {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<DashboardData>({
    queryKey: [...DASHBOARD_QUERY_KEY, userId],
    queryFn: fetchDashboardData,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: "always", // journey recency depends on last activity, not wall-clock staleness
  });
};
