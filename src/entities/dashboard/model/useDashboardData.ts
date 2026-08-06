import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "../api/dashboardApi";
import type { DashboardData } from "./types";

export const DASHBOARD_QUERY_KEY = ["dashboardData"];

export const useDashboardData = () => {
  return useQuery<DashboardData>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboardData,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: "always", // journey recency depends on last activity, not wall-clock staleness
  });
};
