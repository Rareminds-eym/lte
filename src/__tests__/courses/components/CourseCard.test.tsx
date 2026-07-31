import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/entities/course";
import { CourseCard } from "@/entities/course";

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

afterEach(() => {
  mockNavigate.mockClear();
});

function renderWithRouter(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

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
    renderWithRouter(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Test Course")).toBeInTheDocument();
    expect(
      screen.getByText("A test course description for verification purposes."),
    ).toBeInTheDocument();
  });

  it("renders category and level", () => {
    renderWithRouter(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
  });

  it("renders progress information", () => {
    renderWithRouter(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Level 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("TARGET: L3")).toBeInTheDocument();
  });

  it("renders tags", () => {
    renderWithRouter(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Testing")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("renders duration and XP", () => {
    renderWithRouter(<CourseCard course={baseCourse} />);
    expect(screen.getByText("40 hours")).toBeInTheDocument();
    expect(screen.getByText("500 XP")).toBeInTheDocument();
  });

  it("renders Continue button for in_progress", () => {
    renderWithRouter(<CourseCard course={baseCourse} />);
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("renders Start button for not_started", () => {
    renderWithRouter(<CourseCard course={{ ...baseCourse, status: "not_started", progress: 0 }} />);
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("renders Review button and DONE badge for completed", () => {
    renderWithRouter(<CourseCard course={{ ...baseCourse, status: "completed", progress: 100 }} />);
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });

  it("renders badge when present", () => {
    renderWithRouter(<CourseCard course={baseCourse} />);
    expect(screen.getByText("TST-L2")).toBeInTheDocument();
  });

  it("renders image with lazy loading", () => {
    renderWithRouter(<CourseCard course={baseCourse} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("alt", "Test Course");
  });

  it("does NOT render DONE badge for in_progress courses", () => {
    renderWithRouter(<CourseCard course={baseCourse} />);
    expect(screen.queryByText("DONE")).not.toBeInTheDocument();
  });

  it("does NOT render DONE badge for not_started courses", () => {
    renderWithRouter(<CourseCard course={{ ...baseCourse, status: "not_started" }} />);
    expect(screen.queryByText("DONE")).not.toBeInTheDocument();
  });

  it("does not render badge overlay when badge is undefined", () => {
    renderWithRouter(<CourseCard course={{ ...baseCourse, badge: undefined }} />);
    expect(screen.queryByText("TST-L2")).not.toBeInTheDocument();
  });

  it.each([
    ["Start", "not_started", 0],
    ["Continue", "in_progress", 50],
    ["Review", "completed", 100],
  ] as const)("navigates to detail page when %s is clicked", (label, status, progress) => {
    mockNavigate.mockClear();
    renderWithRouter(<CourseCard course={{ ...baseCourse, status, progress }} />);
    fireEvent.click(screen.getByText(label));
    expect(mockNavigate).toHaveBeenCalledWith("/my-courses/TEST-CAP-01");
  });

  it("encodes special characters in capabilityCode", () => {
    mockNavigate.mockClear();
    renderWithRouter(
      <CourseCard
        course={{
          ...baseCourse,
          capabilityCode: "CAP/123&test",
          status: "not_started",
          progress: 0,
        }}
      />,
    );
    fireEvent.click(screen.getByText("Start"));
    expect(mockNavigate).toHaveBeenCalledWith("/my-courses/CAP%2F123%26test");
  });

  it("renders correctly in list variant", () => {
    renderWithRouter(<CourseCard course={baseCourse} variant="list" />);
    expect(screen.getByText("Test Course")).toBeInTheDocument();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "Test Course");
    expect(img).toHaveAttribute("loading", "lazy");
  });
});
