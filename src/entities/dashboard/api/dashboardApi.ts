import type { DashboardData } from "../model/types";

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
    activeTrackTitle: "Backend Engineering",
    matchPercentage: 45,
    description:
      "This role channels the student's analytical mindset into designing APIs, databases, and scalable services that power real-world products used by thousands of people.",
    whyItFits:
      "This role aligns perfectly with the student's logical reasoning and problem-solving strengths, enabling them to build powerful, reliable systems that form the backbone of modern applications.",
    overallProgress: 35,
    capabilitiesCount: 6,
    competitionCount: 1,
    marketStatusPercentage: 80,
    tracks: [
      {
        id: "tr-1",
        title: "Backend Engineering",
        matchPercentage: 45,
        isSelected: true,
      },
      {
        id: "tr-2",
        title: "Full-Stack Development",
        matchPercentage: 25,
        isSelected: false,
      },
      {
        id: "tr-3",
        title: "DevOps & Platform Engineering",
        isExplore: true,
        isSelected: false,
      },
    ],
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

export const fetchDashboardData = async (): Promise<DashboardData> => {
  // Simulates fast remote response for TanStack Query
  return Promise.resolve(MOCK_DASHBOARD_DATA);
};
