import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Courses } from "@/pages/courses";

vi.mock("@/features/initialize-learning-path", () => ({
  LearningPathInitializer: () => null,
}));

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
    roleId: "role-backend",
    roleName: "Backend Engineer",
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
    roleId: "role-backend",
    roleName: "Backend Engineer",
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
    roleId: "role-backend",
    roleName: "Backend Engineer",
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
    roleId: "role-frontend",
    roleName: "Frontend Engineer",
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
    roleId: "role-frontend",
    roleName: "Frontend Engineer",
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
    roleId: "role-frontend",
    roleName: "Frontend Engineer",
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
    roleId: "role-qa",
    roleName: "QA Engineer",
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
    roleId: "role-qa",
    roleName: "QA Engineer",
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

vi.mock("@/features/initialize-learning-path", () => ({
  LearningPathInitializer: () => null,
}));

describe("Courses", () => {
  const renderCourses = () =>
    render(
      <MemoryRouter>
        <Courses />
      </MemoryRouter>,
    );

  const getRequiredTab = (index: number) => {
    const tab = screen.getAllByRole("tab")[index];
    if (!tab) {
      throw new Error(`Expected tab at index ${index}`);
    }
    return tab;
  };

  it("renders page title and description", () => {
    renderCourses();
    expect(screen.getByText("My Courses")).toBeInTheDocument();
    expect(
      screen.getByText("Track your enrolled courses and continue where you left off."),
    ).toBeInTheDocument();
  });

  it("renders role tabs", () => {
    renderCourses();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent("All Roles");
    expect(tabs[1]).toHaveTextContent("Backend Engineer");
    expect(tabs[2]).toHaveTextContent("Frontend Engineer");
    expect(tabs[3]).toHaveTextContent("QA Engineer");
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

  it("shows 3 Backend Engineer courses after filtering", () => {
    renderCourses();
    fireEvent.click(getRequiredTab(1));
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(3);
  });

  it("shows 3 Frontend Engineer courses after filtering", () => {
    renderCourses();
    fireEvent.click(getRequiredTab(2));
    const cards = screen.getAllByTestId("course-card");
    expect(cards.length).toBe(3);
  });

  it("resets to page 1 when filtering by role", () => {
    renderCourses();
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(screen.getAllByTestId("course-card").length).toBe(2);
    fireEvent.click(getRequiredTab(1));
    expect(screen.getAllByTestId("course-card").length).toBe(3);
  });

  it("updates course count text when filtering", () => {
    renderCourses();
    expect(screen.getByText("8 courses")).toBeInTheDocument();
    fireEvent.click(getRequiredTab(3));
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
