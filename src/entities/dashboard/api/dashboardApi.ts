import { apiFetch } from "@/shared/api";
import {
  DashboardJourneyResponseSchema,
  DashboardStreakResponseSchema,
  DashboardXpResponseSchema,
} from "../model/dashboardSchemas";
import type { DashboardData } from "../model/types";

// Static base payload for dashboard sections that have no backend endpoint
// yet; also doubles as the widget-test fixture (not barrel-exported).
// Live data (XP totals, journey) is always overwritten from the API; failures
// surface honest zeroes/null, never fabricated numbers.
export const MOCK_DASHBOARD_DATA: DashboardData = {
  careerTarget: {
    title: "Backend Engineer",
    readinessPercentage: 45,
    strengthsCount: 3,
    capabilityGapsCount: 4,
    domain: "Backend Engineering",
    industry: "IT & Software",
    level: "Undergrad • Foundation",
    xp: 1240,
    xpThisWeek: 120,
    streakDays: 7,
    badgesCount: 18,
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
    items: [
      {
        id: "pri-1",
        title: "Submit your API latency root-cause analysis",
        subtitle: "Milestone 3 • Artifact Submission",
        duration: "25 min",
        xpReward: 35,
        type: "green",
      },
      {
        id: "pri-2",
        title: "Review Visual Hierarchy before the challenge",
        subtitle: "Module 3 • Concept Refresher",
        duration: "15 min",
        xpReward: 15,
        type: "purple",
      },
      {
        id: "pri-3",
        title: "Attempt Knowledge Check",
        subtitle: "Quick Check • 5 Questions",
        duration: "10 min",
        xpReward: 10,
        type: "amber",
      },
    ],
  },
  capabilityGaps: [
    {
      id: "cap-1",
      capability: "Systems Thinking",
      currentLevel: "Developing",
      targetLevel: "Proficient",
    },
    {
      id: "cap-2",
      capability: "API Design",
      currentLevel: "Working Knowledge",
      targetLevel: "Proficient",
    },
    {
      id: "cap-3",
      capability: "Debugging",
      currentLevel: "Developing",
      targetLevel: "Proficient",
    },
    {
      id: "cap-4",
      capability: "Database Design",
      currentLevel: "Foundation",
      targetLevel: "Proficient",
    },
    {
      id: "cap-5",
      capability: "Communication",
      currentLevel: "Proficient",
      targetLevel: "Proficient",
    },
  ],
  upcomingFeedback: {
    upcoming: [
      {
        id: "up-1",
        title: "Mock Interview Session",
        subtitle: "Round 2 • Systems & Architecture",
        tag: "Tomorrow 4:00 PM",
        type: "education",
      },
      {
        id: "up-2",
        title: "Portfolio Review",
        subtitle: "Submit work for mentor feedback",
        tag: "Fri, Jul 19",
        type: "portfolio",
      },
    ],
    recentFeedback: [
      {
        id: "fb-1",
        title: "Mock Interview #3 Result",
        subtitle: "High in communication, needs work in design",
        daysAgo: "2d",
        type: "interview",
      },
      {
        id: "fb-2",
        title: "AI Mentor Weekly Review",
        subtitle: "Strong progress. Continue on API module.",
        daysAgo: "5d",
        type: "ai-mentor",
      },
    ],
  },
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
    unlockedCount: 18,
    shownCount: 4,
    items: [
      {
        id: "ach-1",
        title: "First Project",
        subtitle: "Artifact submitted",
        iconType: "project",
      },
      {
        id: "ach-2",
        title: "7-Day Streak",
        subtitle: "Consistency",
        iconType: "streak",
      },
      {
        id: "ach-3",
        title: "API Mastery",
        subtitle: "All API modules",
        iconType: "api",
      },
      {
        id: "ach-4",
        title: "System Architect",
        subtitle: "5 design modules",
        iconType: "architect",
      },
    ],
    nextMilestoneTitle: "Next Milestone",
    nextMilestoneDescription: "Complete 2 more system design modules to unlock System Architect",
    nextMilestoneProgressPercentage: 60,
  },
};

const localMidnight = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const fetchDashboardData = async (): Promise<DashboardData> => {
  const now = new Date();
  const localMonday = new Date(now);
  localMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const [xpResult, streakResult, journeyResult] = await Promise.allSettled([
    apiFetch(
      `/api/v1/dashboard/xp?since=${encodeURIComponent(localMidnight(localMonday).toISOString())}&todaySince=${encodeURIComponent(localMidnight(now).toISOString())}`,
    ),
    apiFetch("/api/v1/dashboard/streak"),
    apiFetch("/api/v1/dashboard/journey"),
  ]);

  const base = { ...MOCK_DASHBOARD_DATA };

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
