import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MOCK_DASHBOARD_DATA } from "@/entities/dashboard";

import {
  Achievements,
  CapabilityGapMap,
  CareerPaths,
  CareerTargetBanner,
  JourneyHero,
  TodaysPriorities,
  UpcomingFeedback,
} from "@/widgets";

vi.mock("@/entities/active-learning-path", () => ({
  useLearningPathStore: Object.assign(
    vi.fn().mockImplementation((selector) => {
      const mockState = {
        activeTrack: null,
        activeLearningPathLoading: false,
        switchActiveTrack: vi.fn().mockResolvedValue(undefined),
      };
      return selector(mockState);
    }),
    {
      getState: () => ({
        activeTrack: null,
        activeLearningPathLoading: false,
        switchActiveTrack: vi.fn().mockResolvedValue(undefined),
      }),
    },
  ),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

const samplePriorities = {
  currentXp: 120,
  goalXp: 150,
  items: [
    {
      id: "pri-1",
      title: "Submit your API latency root-cause analysis",
      subtitle: "Milestone 3 • Artifact Submission",
      duration: "25 min",
      xpReward: 35,
      type: "green" as const,
    },
    {
      id: "pri-2",
      title: "Review Visual Hierarchy before the challenge",
      subtitle: "Module 3 • Concept Refresher",
      duration: "15 min",
      xpReward: 15,
      type: "purple" as const,
    },
    {
      id: "pri-3",
      title: "Attempt Knowledge Check",
      subtitle: "Quick Check • 5 Questions",
      duration: "10 min",
      xpReward: 10,
      type: "amber" as const,
    },
  ],
};

const sampleGaps = [
  {
    id: "cap-1",
    capability: "Systems Thinking",
    currentLevel: "Developing" as const,
    targetLevel: "Proficient" as const,
  },
  {
    id: "cap-2",
    capability: "API Design",
    currentLevel: "Working Knowledge" as const,
    targetLevel: "Proficient" as const,
  },
  {
    id: "cap-3",
    capability: "Debugging",
    currentLevel: "Developing" as const,
    targetLevel: "Proficient" as const,
  },
  {
    id: "cap-4",
    capability: "Database Design",
    currentLevel: "Foundation" as const,
    targetLevel: "Proficient" as const,
  },
  {
    id: "cap-5",
    capability: "Communication",
    currentLevel: "Proficient" as const,
    targetLevel: "Proficient" as const,
  },
];

const sampleFeedback = {
  upcoming: [
    {
      id: "up-1",
      title: "Mock Interview Session",
      subtitle: "Round 2 • Systems & Architecture",
      tag: "Tomorrow 4:00 PM",
      type: "education" as const,
    },
    {
      id: "up-2",
      title: "Portfolio Review",
      subtitle: "Submit work for mentor feedback",
      tag: "Fri, Jul 19",
      type: "portfolio" as const,
    },
  ],
  recentFeedback: [
    {
      id: "fb-1",
      title: "Mock Interview #3 Result",
      subtitle: "High in communication, needs work in design",
      daysAgo: "2d",
      type: "interview" as const,
    },
    {
      id: "fb-2",
      title: "AI Mentor Weekly Review",
      subtitle: "Strong progress. Continue on API module.",
      daysAgo: "5d",
      type: "ai-mentor" as const,
    },
  ],
};

const sampleAchievements = {
  unlockedCount: 18,
  shownCount: 4,
  items: [
    {
      id: "ach-1",
      title: "First Project",
      subtitle: "Artifact submitted",
      iconType: "project" as const,
    },
    { id: "ach-2", title: "7-Day Streak", subtitle: "Consistency", iconType: "streak" as const },
    { id: "ach-3", title: "API Mastery", subtitle: "All API modules", iconType: "api" as const },
    {
      id: "ach-4",
      title: "System Architect",
      subtitle: "5 design modules",
      iconType: "architect" as const,
    },
  ],
  nextMilestoneTitle: "Next Milestone",
  nextMilestoneDescription: "Complete 2 more system design modules to unlock System Architect",
  nextMilestoneProgressPercentage: 60,
};

const sampleJourney = {
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
  levelId: "lvl-1",
  moduleNo: 3,
  capabilityCode: "SYS-001",
};

describe("Dashboard Widgets", () => {
  it("renders CareerTargetBanner with readiness stats and gamification metrics", () => {
    render(<CareerTargetBanner data={MOCK_DASHBOARD_DATA.careerTarget} />);
    expect(screen.getByText("Career Target")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("0 Strengths")).toBeInTheDocument();
    expect(screen.getByText("0 Capability Gaps")).toBeInTheDocument();
    expect(screen.getByText("0 Days")).toBeInTheDocument();
  });

  it("renders JourneyHero with progress percentage and action buttons", () => {
    render(
      <MemoryRouter>
        <JourneyHero data={sampleJourney} state="active" />
      </MemoryRouter>,
    );
    expect(screen.getByText("CONTINUE YOUR JOURNEY")).toBeInTheDocument();
    expect(screen.getByText("Debugging API Latency Issues")).toBeInTheDocument();
    expect(screen.getByText("Module 3 of 7")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Continue Challenge")).toBeInTheDocument();
    expect(screen.getByText("View Details")).toBeInTheDocument();
  });

  it("renders JourneyHero empty state with completed CTA when journey is complete", () => {
    render(
      <MemoryRouter>
        <JourneyHero data={null} state="completed" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Level Complete — Outstanding Work!")).toBeInTheDocument();
    expect(screen.getByText("Choose Next Capability")).toBeInTheDocument();
    expect(screen.queryByText("Continue Challenge")).not.toBeInTheDocument();
  });

  it("renders JourneyHero empty state with explore CTA when no track exists", () => {
    render(
      <MemoryRouter>
        <JourneyHero data={null} state="no_track" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Your Journey Starts Here")).toBeInTheDocument();
    expect(screen.getByText("Explore Career Paths")).toBeInTheDocument();
    expect(screen.queryByText("Continue Challenge")).not.toBeInTheDocument();
  });

  it("renders TodaysPriorities with daily XP goal and task list", () => {
    render(<TodaysPriorities data={samplePriorities} />);
    expect(screen.getByText("Today's Priorities")).toBeInTheDocument();
    expect(screen.getByText("120 / 150 XP")).toBeInTheDocument();
    expect(screen.getByText("Submit your API latency root-cause analysis")).toBeInTheDocument();
    expect(screen.getByText("Review Visual Hierarchy before the challenge")).toBeInTheDocument();
    expect(screen.getByText("Attempt Knowledge Check")).toBeInTheDocument();
  });

  it("renders CapabilityGapMap with 5 capabilities and level pills", () => {
    render(<CapabilityGapMap data={sampleGaps} />);
    expect(screen.getByText("Capability Gap Map")).toBeInTheDocument();
    expect(screen.getByText("Systems Thinking")).toBeInTheDocument();
    expect(screen.getByText("API Design")).toBeInTheDocument();
    expect(screen.getByText("Debugging")).toBeInTheDocument();
    expect(screen.getByText("Database Design")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getAllByText("Proficient").length).toBeGreaterThan(0);
  });

  it("renders UpcomingFeedback with upcoming sessions and recent reviews", () => {
    render(<UpcomingFeedback data={sampleFeedback} />);
    expect(screen.getByText("Upcoming & Feedback")).toBeInTheDocument();
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
    expect(screen.getByText("Mock Interview Session")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow 4:00 PM")).toBeInTheDocument();
    expect(screen.getByText("RECENT FEEDBACK")).toBeInTheDocument();
    expect(screen.getByText("Mock Interview #3 Result")).toBeInTheDocument();
    expect(screen.getByText("2d")).toBeInTheDocument();
  });

  it("renders CareerPaths with track explorer and match stats", () => {
    const mockCareerPaths = {
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
          fit: "High",
        },
        {
          id: "tr-2",
          title: "Full-Stack Development",
          matchPercentage: 25,
          isSelected: false,
          fit: "Medium",
        },
        {
          id: "tr-3",
          title: "DevOps & Platform Engineering",
          isExplore: true,
          isSelected: false,
          fit: "Explore",
        },
      ],
    };
    render(
      <MemoryRouter>
        <CareerPaths data={mockCareerPaths} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Recommended Career Paths")).toBeInTheDocument();
    expect(screen.getByText("Track A")).toBeInTheDocument();
    expect(screen.getByText("WHY IT FITS")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("Curriculum Analysis")).toBeInTheDocument();
  });

  it("renders Achievements with 2x2 grid and milestone progress", () => {
    render(<Achievements data={sampleAchievements} />);
    expect(screen.getByText("Achievements")).toBeInTheDocument();
    expect(screen.getByText("First Project")).toBeInTheDocument();
    expect(screen.getByText("7-Day Streak")).toBeInTheDocument();
    expect(screen.getByText("API Mastery")).toBeInTheDocument();
    expect(screen.getByText("System Architect")).toBeInTheDocument();
    expect(screen.getByText("Next Milestone")).toBeInTheDocument();
  });

  it("renders UpcomingFeedback empty state when no data", () => {
    render(<UpcomingFeedback data={null} />);
    expect(screen.getByText("No upcoming sessions.")).toBeInTheDocument();
    expect(screen.getByText("No recent feedback.")).toBeInTheDocument();
  });

  it("renders TodaysPriorities empty when no items", () => {
    render(<TodaysPriorities data={{ currentXp: 0, goalXp: 150, items: [] }} />);
    expect(screen.getByText("Today's Priorities")).toBeInTheDocument();
    expect(screen.getByText("0 / 150 XP")).toBeInTheDocument();
  });
});
