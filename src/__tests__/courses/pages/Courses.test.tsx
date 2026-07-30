import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Courses } from "@/pages/courses";

const mockCourses = vi.hoisted(() => [
  {
    id: "1",
    capabilityId: "1",
    capabilityCode: "CAP-01",
    title: "Course 1",
    description: "Desc 1",
    category: "Core",
    level: "L2",
    imageUrl: "",
    tags: [],
    status: "in_progress" as const,
    progress: 20,
    currentLevel: 1,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 500,
    priority: "Core",
  },
  {
    id: "2",
    capabilityId: "2",
    capabilityCode: "CAP-02",
    title: "Course 2",
    description: "Desc 2",
    category: "Important",
    level: "L2",
    imageUrl: "",
    tags: [],
    status: "completed" as const,
    progress: 100,
    currentLevel: 5,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 40,
    xp: 300,
    priority: "Important",
  },
  {
    id: "3",
    capabilityId: "3",
    capabilityCode: "CAP-03",
    title: "Course 3",
    description: "Desc 3",
    category: "Supporting",
    level: "L2",
    imageUrl: "",
    tags: [],
    status: "not_started" as const,
    progress: 0,
    currentLevel: 0,
    totalLevels: 4,
    targetLevel: "L3",
    durationHours: 25,
    xp: 350,
    priority: "Supporting",
  },
  {
    id: "4",
    capabilityId: "4",
    capabilityCode: "CAP-04",
    title: "Course 4",
    description: "Desc 4",
    category: "Core",
    level: "L2",
    imageUrl: "",
    tags: [],
    status: "in_progress" as const,
    progress: 60,
    currentLevel: 3,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 320,
    priority: "Core",
  },
  {
    id: "5",
    capabilityId: "5",
    capabilityCode: "CAP-05",
    title: "Course 5",
    description: "Desc 5",
    category: "Core",
    level: "L2",
    imageUrl: "",
    tags: [],
    status: "not_started" as const,
    progress: 0,
    currentLevel: 0,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 500,
    priority: "Core",
  },
  {
    id: "6",
    capabilityId: "6",
    capabilityCode: "CAP-06",
    title: "Course 6",
    description: "Desc 6",
    category: "Core",
    level: "L2",
    imageUrl: "",
    tags: [],
    status: "completed" as const,
    progress: 100,
    currentLevel: 5,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 300,
    priority: "Core",
  },
  {
    id: "7",
    capabilityId: "7",
    capabilityCode: "CAP-07",
    title: "Course 7",
    description: "Desc 7",
    category: "Important",
    level: "L2",
    imageUrl: "",
    tags: [],
    status: "completed" as const,
    progress: 100,
    currentLevel: 5,
    totalLevels: 5,
    targetLevel: "L4",
    durationHours: 40,
    xp: 550,
    priority: "Important",
  },
  {
    id: "8",
    capabilityId: "8",
    capabilityCode: "CAP-08",
    title: "Course 8",
    description: "Desc 8",
    category: "Supporting",
    level: "L2",
    imageUrl: "",
    tags: [],
    status: "not_started" as const,
    progress: 0,
    currentLevel: 0,
    totalLevels: 4,
    targetLevel: "L3",
    durationHours: 25,
    xp: 350,
    priority: "Supporting",
  },
]);

vi.mock("@/entities/course", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/entities/course")>();
  return {
    ...actual,
    useCourses: vi.fn().mockReturnValue({
      data: mockCourses,
      isLoading: false,
      error: null,
    }),
  };
});

describe("Courses", () => {
  const renderCourses = () =>
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );

  it("renders page title and description", () => {
    renderCourses();
    expect(screen.getByText("My Courses")).toBeInTheDocument();
    expect(
      screen.getByText("Track your enrolled courses and continue where you left off."),
    ).toBeInTheDocument();
  });

  it("renders priority tabs", () => {
    renderCourses();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent("All");
    expect(tabs[1]).toHaveTextContent("Core");
    expect(tabs[2]).toHaveTextContent("Important");
    expect(tabs[3]).toHaveTextContent("Supporting");
  });

  it("shows 6 course cards on page 1 (PAGE_SIZE)", () => {
    renderCourses();
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(6);
  });

  it("paginates to page 2 showing remaining courses", () => {
    renderCourses();
    fireEvent.click(screen.getByLabelText("Next page"));
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(2);
  });

  it("shows 4 Core courses after filtering", () => {
    renderCourses();
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[1]!);
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(4);
  });

  it("shows 2 Supporting courses after filtering", () => {
    renderCourses();
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[3]!);
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(2);
  });

  it("resets to page 1 when filtering by priority", () => {
    renderCourses();
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getAllByTestId("course-card").length).toBe(2);
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[1]!);
    expect(screen.getAllByTestId("course-card").length).toBe(4);
  });

  it("updates course count text when filtering", () => {
    renderCourses();
    expect(screen.getByText("8 courses")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[3]!);
    expect(screen.getByText("2 courses")).toBeInTheDocument();
  });

  it("shows Filter button", () => {
    renderCourses();
    expect(screen.getByText("Filter")).toBeInTheDocument();
  });

  it("disables previous page button on first page", () => {
    renderCourses();
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
  });

  it("shows total enrolled count in stats pills", () => {
    renderCourses();
    expect(screen.getByText("8 Enrolled")).toBeInTheDocument();
  });
});
