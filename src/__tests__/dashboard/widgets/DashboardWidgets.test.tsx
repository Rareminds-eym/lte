import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const switchTrack = vi.hoisted(() => vi.fn());

vi.mock("@/entities/active-learning-path", () => ({
  useLearningPath: Object.assign(
    vi.fn().mockImplementation((selector) => {
      const mockState = {
        activeTrack: null,
        activeLearningPathLoading: false,
        switchActiveTrack: switchTrack,
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

describe("Dashboard Widgets", () => {
  beforeEach(() => {
    switchTrack.mockReset().mockResolvedValue(undefined);
  });

  it("blocks repeated track switches until the first request completes", async () => {
    let finish: () => void = () => {};
    switchTrack.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <MemoryRouter>
        <CareerPaths
          data={{
            ...MOCK_DASHBOARD_DATA.careerPaths,
            tracks: [
              { id: "active", title: "Backend", isSelected: true },
              { id: "next", title: "Frontend" },
              { id: "other", title: "DevOps" },
            ],
          }}
        />
      </MemoryRouter>,
    );
    const next = screen.getByRole("button", { name: "Switch to Frontend" });
    const other = screen.getByRole("button", { name: "Switch to DevOps" });
    fireEvent.click(next);
    fireEvent.click(other);
    expect(switchTrack).toHaveBeenCalledExactlyOnceWith("next");
    expect(next).toBeDisabled();
    expect(other).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Switching to Frontend…");
    await act(async () => finish());
    expect(next).toBeEnabled();
  });

  it("clamps journey progress and disables actions when route context is missing", () => {
    const journey = MOCK_DASHBOARD_DATA.journey;
    if (!journey) throw new Error("Expected a journey fixture");
    render(
      <MemoryRouter>
        <JourneyHero data={{ ...journey, progressPercentage: 140 }} state="active" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("progressbar", { name: "Journey progress" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByRole("button", { name: "Continue Challenge" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "View Details" })).toBeDisabled();
  });
  it("renders CareerTargetBanner with readiness stats and gamification metrics", () => {
    render(<CareerTargetBanner data={MOCK_DASHBOARD_DATA.careerTarget} />);
    expect(screen.getByText("Career Target")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("3 Strengths")).toBeInTheDocument();
    expect(screen.getByText("4 Capability Gaps")).toBeInTheDocument();
    expect(screen.getByText("1,240")).toBeInTheDocument();
    expect(screen.getByText("7 Days")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("renders JourneyHero with progress percentage and action buttons", () => {
    render(
      <MemoryRouter>
        <JourneyHero data={MOCK_DASHBOARD_DATA.journey} state={MOCK_DASHBOARD_DATA.journeyState} />
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
    render(<TodaysPriorities data={MOCK_DASHBOARD_DATA.priorities} />);
    expect(screen.getByText("Today's Priorities")).toBeInTheDocument();
    expect(screen.getByText("120 / 150 XP")).toBeInTheDocument();
    expect(screen.getByText("Submit your API latency root-cause analysis")).toBeInTheDocument();
    expect(screen.getByText("Review Visual Hierarchy before the challenge")).toBeInTheDocument();
    expect(screen.getByText("Attempt Knowledge Check")).toBeInTheDocument();
  });

  it("renders CapabilityGapMap with 5 capabilities and level pills", () => {
    render(<CapabilityGapMap data={MOCK_DASHBOARD_DATA.capabilityGaps} />);
    expect(screen.getByText("Capability Gap Map")).toBeInTheDocument();
    expect(screen.getByText("Systems Thinking")).toBeInTheDocument();
    expect(screen.getByText("API Design")).toBeInTheDocument();
    expect(screen.getByText("Debugging")).toBeInTheDocument();
    expect(screen.getByText("Database Design")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getAllByText("Proficient").length).toBeGreaterThan(0);
  });

  it("renders UpcomingFeedback with upcoming sessions and recent reviews", () => {
    render(
      <MemoryRouter>
        <UpcomingFeedback data={MOCK_DASHBOARD_DATA.upcomingFeedback} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Upcoming & Feedback")).toBeInTheDocument();
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
    expect(screen.getByText("Mock Interview Session")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow 4:00 PM")).toBeInTheDocument();
    expect(screen.getByText("RECENT FEEDBACK")).toBeInTheDocument();
    expect(screen.getByText("Mock Interview #3 Result")).toBeInTheDocument();
    expect(screen.getByText("2d")).toBeInTheDocument();
  });

  it("offers feedback retry and disables it during the request", () => {
    const onRetry = vi.fn();
    const data = { upcoming: [], recentFeedback: [], error: "Feedback unavailable" };
    const { rerender } = render(
      <MemoryRouter>
        <UpcomingFeedback data={data} onRetry={onRetry} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry feedback" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText("No staff reviews pending.")).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <UpcomingFeedback data={data} onRetry={onRetry} retrying />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();
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
    render(<Achievements data={MOCK_DASHBOARD_DATA.achievements} />);
    expect(screen.getByText("Achievements")).toBeInTheDocument();
    expect(screen.getByText("First Project")).toBeInTheDocument();
    expect(screen.getByText("7-Day Streak")).toBeInTheDocument();
    expect(screen.getByText("API Mastery")).toBeInTheDocument();
    expect(screen.getByText("System Architect")).toBeInTheDocument();
    expect(screen.getByText("Next Milestone")).toBeInTheDocument();
  });
});
