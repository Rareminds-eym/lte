import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
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

describe("Dashboard Widgets", () => {
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
    render(<UpcomingFeedback data={MOCK_DASHBOARD_DATA.upcomingFeedback} />);
    expect(screen.getByText("Upcoming & Feedback")).toBeInTheDocument();
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();
    expect(screen.getByText("Mock Interview Session")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow 4:00 PM")).toBeInTheDocument();
    expect(screen.getByText("RECENT FEEDBACK")).toBeInTheDocument();
    expect(screen.getByText("Mock Interview #3 Result")).toBeInTheDocument();
    expect(screen.getByText("2d")).toBeInTheDocument();
  });

  it("renders CareerPaths with track explorer and match stats", () => {
    render(<CareerPaths data={MOCK_DASHBOARD_DATA.careerPaths} />);
    expect(screen.getByText("Recommended Career Paths")).toBeInTheDocument();
    expect(screen.getByText("Track Explorer")).toBeInTheDocument();
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
