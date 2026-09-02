import { useQuery } from "@tanstack/react-query";
import { getLogger } from "@/shared";
import { apiFetch } from "@/shared/api";
import {
  DashboardJourneyResponseSchema,
  DashboardStreakResponseSchema,
  DashboardXpResponseSchema,
} from "../model/dashboardSchemas";
import type { DashboardData } from "../model/types";

const logger = getLogger("dashboardApi");

// Static base payload — live data (XP totals, journey, streak) is overwritten
// from the API; sections without endpoints surface honest empty/null, never fabricated numbers.
export const MOCK_DASHBOARD_DATA: DashboardData = {
  careerTarget: {
    title: "Backend Engineer", // test fixture only
    readinessPercentage: 0,
    strengthsCount: 0,
    capabilityGapsCount: 0,
    domain: "",
    industry: "",
    level: "",
    xp: 1240,
    xpThisWeek: 120,
    streakDays: 7,
    badgesCount: 0,
  },
  journey: {
    title: "Debugging API Latency Issues",
    moduleInfo: "Module 3 of 7",
    capability: "Systems Thinking",
    output: "Root-cause analysis artifact",
    whyItMatters: "Essential for backend performance & reliability",
    progressPercentage: 60,
    completedCount: 4,
    inProgressCount: 1,
    remainingCount: 2,
    timeRemaining: "~18 min remaining",
  },
  journeyState: "active",
  priorities: {
    currentXp: 120,
    goalXp: 150,
    items: [],
  },
  capabilityGaps: [],
  upcomingFeedback: null,
  careerPaths: {
    activeTrackTitle: "",
    matchPercentage: 0,
    description: "",
    whyItFits: "",
    overallProgress: 0,
    capabilitiesCount: 0,
    competitionCount: 0,
    marketStatusPercentage: 0,
    tracks: [],
  },
  achievements: {
    unlockedCount: 0,
    shownCount: 0,
    items: [],
    nextMilestoneTitle: "",
    nextMilestoneDescription: "",
    nextMilestoneProgressPercentage: 0,
  },
};

const localMidnight = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const fetchDashboardData = async (signal?: AbortSignal): Promise<DashboardData> => {
  const now = new Date();
  const localMonday = new Date(now);
  localMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const [xpResult, streakResult, journeyResult] = await Promise.allSettled([
    apiFetch(
      `/api/v1/dashboard/xp?since=${encodeURIComponent(localMidnight(localMonday).toISOString())}&todaySince=${encodeURIComponent(localMidnight(now).toISOString())}`,
      { signal },
    ),
    apiFetch("/api/v1/dashboard/streak", { signal }),
    apiFetch("/api/v1/dashboard/journey", { signal }),
  ]);

  // Throw AbortError immediately to escape fallback logic
  const abortError = [xpResult, streakResult, journeyResult].find(
    (res) =>
      res.status === "rejected" &&
      res.reason instanceof Error &&
      (res.reason.name === "AbortError" ||
        (res.reason instanceof DOMException && res.reason.code === 20)),
  );
  if (abortError && abortError.status === "rejected") {
    logger.info("fetchDashboardData aborted by query cancellation");
    throw abortError.reason;
  }

  const base = { ...MOCK_DASHBOARD_DATA };
  // Honest empty when no real data — never fabricated mock
  base.careerTarget = {
    ...base.careerTarget,
    readinessPercentage: 0,
    strengthsCount: 0,
    capabilityGapsCount: 0,
    badgesCount: 0,
    domain: "",
    industry: "",
    level: "",
  };
  base.capabilityGaps = [];
  base.priorities = { ...base.priorities, items: [] };
  base.achievements = {
    ...base.achievements,
    items: [],
    unlockedCount: 0,
    shownCount: 0,
    nextMilestoneTitle: "",
    nextMilestoneDescription: "",
    nextMilestoneProgressPercentage: 0,
  };
  base.upcomingFeedback = null;

  const parsedXp =
    xpResult.status === "fulfilled" ? DashboardXpResponseSchema.safeParse(xpResult.value) : null;
  if (parsedXp?.success) {
    base.careerTarget = {
      ...base.careerTarget,
      xp: parsedXp.data.totalXp,
      xpThisWeek: parsedXp.data.xpThisWeek,
    };
    base.priorities = {
      ...base.priorities,
      currentXp: parsedXp.data.todayXp,
    };
    base.todayEvents = parsedXp.data.todayEvents;
  } else {
    // Never show fabricated fixture XP: honest zeroes when the API fails.
    base.careerTarget = { ...base.careerTarget, xp: 0, xpThisWeek: 0 };
    base.priorities = { ...base.priorities, currentXp: 0 };
  }

  const parsedStreak =
    streakResult.status === "fulfilled"
      ? DashboardStreakResponseSchema.safeParse(streakResult.value)
      : null;
  base.careerTarget = {
    ...base.careerTarget,
    streakDays: parsedStreak?.success ? parsedStreak.data.streakDays : 0,
  };

  const parsedJourney =
    journeyResult.status === "fulfilled"
      ? DashboardJourneyResponseSchema.safeParse(journeyResult.value)
      : null;
  if (parsedJourney?.success) {
    base.journey = parsedJourney.data.data;
    base.journeyState = parsedJourney.data.state;
  } else {
    // Never show stale mock data: an empty hero state is honest.
    base.journey = null;
    base.journeyState = "active";
  }
  return base;
};

// --- Readiness ---
export interface ReadinessResponse {
  score: number;
  band: string;
  lastCalculated?: string;
  currentRole?: { name: string; domain: string; family: string } | null;
  components: {
    courseCompletion: { value: number; weight: number };
    artifactCompletion: { value: number; weight: number };
    aiAverageScore: { value: number; weight: number };
    xpAchievement: { value: number; weight: number };
    profileCompletion: { value: number; weight: number };
  };
  missingEvidence: string[];
  configWarnings: string[];
  improvementActions?: string[];
}

export const fetchReadiness = (signal?: AbortSignal): Promise<ReadinessResponse> =>
  apiFetch<ReadinessResponse>("/api/v1/readiness", { signal });

/** @deprecated use readinessQueryKey(userId) — bare key leaks across users */
export const READINESS_QUERY_KEY = ["readiness"] as const;
export const readinessQueryKey = (userId?: string) => ["readiness", userId] as const;

export const useReadiness = (userId?: string, enabled = true) =>
  useQuery({
    queryKey: readinessQueryKey(userId),
    queryFn: ({ signal }) => fetchReadiness(signal),
    enabled: !!userId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
