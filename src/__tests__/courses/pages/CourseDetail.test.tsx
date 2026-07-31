import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCapabilityLevels } from "@/entities/course";
import { CourseDetail } from "@/pages/course-detail";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ capabilityCode: "TEST-CAP-101" }),
    useLocation: () => ({
      pathname: "/my-courses/TEST-CAP-101",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }),
  };
});

vi.mock("@/features/initialize-learning-path", () => ({
  LearningPathInitializer: () => <div data-testid="learning-path-initializer" />,
}));

const mockDbLevels = vi.hoisted(() => [
  {
    id: "lvl-1",
    levelNumber: 1,
    code: "TEST_L1_CL001",
    title: "Guided Observability & Core Foundations",
    description: "Identify key parameters and establish foundation dashboards.",
    deliverables: ["Observability Setup Worksheet", "Foundations Checklist"],
    durationMinutes: 2700,
    difficulty: "beginner",
    status: "published",
  },
  {
    id: "lvl-2",
    levelNumber: 2,
    code: "TEST_L2_CL001",
    title: "Applied Observability & Implementation",
    description: "Configure operational parameters and define threshold rules.",
    deliverables: ["Observability Config Sheet"],
    durationMinutes: 2700,
    difficulty: "beginner",
    status: "published",
  },
  {
    id: "lvl-3",
    levelNumber: 3,
    code: "TEST_L3_CL001",
    title: "Advanced Observability & Root Cause Analysis",
    description: "Perform end-to-end analysis across distributed environments.",
    deliverables: ["Observability Correlation Map"],
    durationMinutes: 2700,
    difficulty: "intermediate",
    status: "published",
  },
  {
    id: "lvl-4",
    levelNumber: 4,
    code: "TEST_L4_CL001",
    title: "Operational Practices & Incident Management for Observability",
    description: "Lead resolution processes and manage technical mitigations.",
    deliverables: ["Observability Incident Timeline"],
    durationMinutes: 2700,
    difficulty: "advanced",
    status: "published",
  },
  {
    id: "lvl-5",
    levelNumber: 5,
    code: "TEST_L5_CL001",
    title: "Observability Architecture & Systems Design",
    description: "Architect end-to-end enterprise strategies and production designs.",
    deliverables: ["Observability Architecture Blueprint"],
    durationMinutes: 2700,
    difficulty: "advanced",
    status: "published",
  },
]);

vi.mock("@/entities/course", async () => {
  const actual = await vi.importActual<typeof import("@/entities/course")>("@/entities/course");
  return {
    ...actual,
    useCourses: vi.fn(() => ({
      data: [
        {
          id: "cap-1",
          capabilityId: "cap-1",
          capabilityCode: "TEST-CAP-101",
          title: "Observability: Logging, Monitoring & Debugging",
          description:
            "Build guided capability to verify system health through logs, metrics, and traces.",
          category: "Core",
          level: "L3",
          imageUrl: "",
          tags: [],
          status: "in_progress",
          progress: 40,
          currentLevel: 2,
          totalLevels: 5,
          targetLevel: "L3",
          durationHours: 225,
          xp: 1850,
          priority: "Core",
          badge: "OBS-L2",
        },
      ],
      isPending: false,
      error: null,
    })),
    useCapabilityLevels: vi.fn(() => ({
      data: mockDbLevels,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })),
  };
});

type LevelsQuery = ReturnType<typeof useCapabilityLevels>;

function levelsQueryResult(overrides: Partial<LevelsQuery> = {}): LevelsQuery {
  return {
    data: mockDbLevels,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as LevelsQuery;
}

describe("CourseDetail", () => {
  it("renders course hero banner dynamically with capability code and title", () => {
    render(<CourseDetail />);
    expect(screen.getByText("Observability: Logging, Monitoring & Debugging")).toBeInTheDocument();
    expect(screen.getAllByText(/TEST-CAP-101/).length).toBeGreaterThan(0);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("OBS-L2")).toBeInTheDocument();
  });

  it("renders stats overlay card dynamically with duration, XP, and target", () => {
    render(<CourseDetail />);
    expect(screen.getByText("225 hrs")).toBeInTheDocument();
    expect(screen.getByText("1,850 XP")).toBeInTheDocument();
    expect(screen.getByText("Level 2 of 5 unlocked")).toBeInTheDocument();
    expect(screen.getByText("TARGET: L3")).toBeInTheDocument();
  });

  it("renders course levels section and display type toggle", () => {
    render(<CourseDetail />);
    expect(screen.getByText("Course Levels")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete each level to unlock the next. Your target proficiency for this role is Level 3.",
      ),
    ).toBeInTheDocument();

    const cardsButton = screen.getByRole("button", { name: "Cards" });
    const listButton = screen.getByRole("button", { name: "List" });
    expect(cardsButton).toHaveAttribute("aria-pressed", "true");
    expect(listButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByTestId(/^level-card-/)).toHaveLength(5);

    fireEvent.click(listButton);
    expect(listButton).toHaveAttribute("aria-pressed", "true");
    expect(cardsButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryAllByTestId(/^level-card-/)).toHaveLength(0);
    expect(screen.getAllByTestId(/^level-row-/)).toHaveLength(5);
    expect(screen.getByText("🎯 TARGET")).toBeInTheDocument();

    fireEvent.click(cardsButton);
    expect(screen.getAllByTestId(/^level-card-/)).toHaveLength(5);
  });

  it("renders API level data when levels are returned", () => {
    vi.mocked(useCapabilityLevels).mockReturnValueOnce(
      levelsQueryResult({
        data: [
          {
            id: "lvl-1",
            levelNumber: 1,
            code: "TEST_L1_CL001",
            title: "Guided Foundations",
            description: "Learn the basics.",
            deliverables: ["Setup Worksheet"],
            durationMinutes: 360,
            difficulty: "beginner",
            status: "published",
          },
        ],
      }),
    );
    render(<CourseDetail />);
    expect(screen.getByText("Guided Foundations")).toBeInTheDocument();
    expect(screen.getByText("6 hrs")).toBeInTheDocument();
    expect(screen.getByText("Setup Worksheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review →" })).toBeInTheDocument();
  });

  it("renders all 5 course level cards dynamically with appropriate badges and action buttons", () => {
    render(<CourseDetail />);

    // Level 1 - Completed
    expect(screen.getByTestId("level-card-1")).toBeInTheDocument();
    expect(screen.getByText("Guided Observability & Core Foundations")).toBeInTheDocument();
    expect(screen.getByText("✓ Completed")).toBeInTheDocument();
    expect(screen.getByText("Observability Setup Worksheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review →" })).toBeInTheDocument();

    // Level 2 - Unlocked / Active
    expect(screen.getByTestId("level-card-2")).toBeInTheDocument();
    expect(screen.getByText("Applied Observability & Implementation")).toBeInTheDocument();
    expect(screen.getByText("Unlocked")).toBeInTheDocument();
    expect(screen.getByText("Observability Config Sheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue →" })).toBeInTheDocument();

    // Level 3 - Target Level / Locked
    expect(screen.getByTestId("level-card-3")).toBeInTheDocument();
    expect(screen.getByText("Advanced Observability & Root Cause Analysis")).toBeInTheDocument();
    expect(screen.getByText("🎯 TARGET LEVEL")).toBeInTheDocument();
    expect(screen.getByText("Complete Level 2 to unlock")).toBeInTheDocument();
    expect(screen.getByText("Observability Correlation Map")).toBeInTheDocument();

    // Level 4 & 5 - Locked
    expect(screen.getByTestId("level-card-4")).toBeInTheDocument();
    expect(
      screen.getByText("Operational Practices & Incident Management for Observability"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("level-card-5")).toBeInTheDocument();
    expect(screen.getByText("Observability Architecture & Systems Design")).toBeInTheDocument();
  });
});
