import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Course } from "@/entities/course";
import { CourseCard } from "@/entities/course";

const baseCourse: Course = {
  id: "test-1",
  capabilityId: "test-1",
  capabilityCode: "TEST-CAP-01",
  title: "Test Course",
  description: "A test course description for verification purposes.",
  category: "Core",
  level: "Intermediate",
  imageUrl: "https://picsum.photos/seed/test/400/220",
  tags: ["Testing", "Engineering"],
  status: "in_progress",
  progress: 50,
  currentLevel: 2,
  totalLevels: 5,
  targetLevel: "L3",
  durationHours: 40,
  xp: 500,
  badge: "TST-L2",
  priority: "Core",
};

describe("CourseCard", () => {
  it("renders course title and description", () => {
    render(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Test Course")).toBeInTheDocument();
    expect(
      screen.getByText("A test course description for verification purposes."),
    ).toBeInTheDocument();
  });

  it("renders category and level", () => {
    render(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
  });

  it("renders progress information", () => {
    render(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Level 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("TARGET: L3")).toBeInTheDocument();
  });

  it("renders tags", () => {
    render(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Testing")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("renders duration and XP", () => {
    render(<CourseCard course={baseCourse} />);
    expect(screen.getByText("40 hours")).toBeInTheDocument();
    expect(screen.getByText("500 XP")).toBeInTheDocument();
  });

  it("renders Continue button for in_progress", () => {
    render(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("renders Start button for not_started", () => {
    render(<CourseCard course={{ ...baseCourse, status: "not_started", progress: 0 }} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("renders Review button and DONE badge for completed", () => {
    render(<CourseCard course={{ ...baseCourse, status: "completed", progress: 100 }} />);
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });

  it("renders badge when present", () => {
    render(<CourseCard course={baseCourse} />);
    expect(screen.getByText("TST-L2")).toBeInTheDocument();
  });

  it("renders image with lazy loading", () => {
    render(<CourseCard course={baseCourse} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("alt", "Test Course");
  });

  it("does NOT render DONE badge for in_progress courses", () => {
    render(<CourseCard course={baseCourse} />);
    expect(screen.queryByText("DONE")).not.toBeInTheDocument();
  });

  it("does NOT render DONE badge for not_started courses", () => {
    render(<CourseCard course={{ ...baseCourse, status: "not_started" }} />);
    expect(screen.queryByText("DONE")).not.toBeInTheDocument();
  });

  it("does not render badge overlay when badge is undefined", () => {
    render(<CourseCard course={{ ...baseCourse, badge: undefined }} />);
    expect(screen.queryByText("TST-L2")).not.toBeInTheDocument();
  });
});
