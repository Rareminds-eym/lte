import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LevelModuleList } from "@/widgets/level-modules/ui/LevelModuleList";

// Mock navigate hook
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("LevelModuleList", () => {
  it("renders empty modules list correctly", () => {
    render(
      <MemoryRouter>
        <LevelModuleList modules={[]} levelId="lvl-1" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Course Modules")).toBeDefined();
    expect(screen.getByText("0 modules · 6E Problem-Based Learning Framework")).toBeDefined();
    expect(screen.getByText("No modules available")).toBeDefined();
    expect(screen.getByText("Modules have not been added to this level yet.")).toBeDefined();
    expect(screen.queryByText("Course completion locked")).toBeNull();
  });

  it("parses database JSONB array and object fields correctly and calculates dynamic status", () => {
    const modulesData = [
      {
        id: "mod-1",
        moduleNo: 1,
        title: "Module 1",
        description: "Introductory module",
        isCompleted: true,
        progressPercentage: 100,
        module_problem_statement: "Problem statement 1",
        prerequisites: ["Prereq A"],
        user_confusion: { items: ["Confusion A"] },
        what_youll_learn: "Skill A", // string fallback test
        when_to_apply: "Always",
        completedStages: ["engage", "explore"],
      },
      {
        id: "mod-2",
        moduleNo: 2,
        title: "Module 2",
        description: "Active module",
        isCompleted: false,
        progressPercentage: 40,
        module_problem_statement: "Problem statement 2",
        prerequisites: null, // null check
        user_confusion: null,
        what_youll_learn: null,
        when_to_apply: null,
        completedStages: ["engage"],
      },
      {
        id: "mod-3",
        moduleNo: 3,
        title: "Module 3",
        description: "Locked module",
        isCompleted: false,
        progressPercentage: 0,
      },
    ];

    render(
      <MemoryRouter>
        <LevelModuleList
          modules={modulesData as unknown as Parameters<typeof LevelModuleList>[0]["modules"]}
          levelId="lvl-1"
          moduleDurationMinutes={120}
        />
      </MemoryRouter>,
    );

    // Verify Title & Problem
    expect(screen.getByText("Module 1")).toBeDefined();
    expect(screen.getByText("Problem statement 1")).toBeDefined();
    expect(screen.getByText("Prereq A")).toBeDefined();
    expect(screen.getByText("Confusion A")).toBeDefined();
    expect(screen.getByText("Skill A")).toBeDefined();

    // Verify durations (120 min = 2 hrs)
    expect(screen.getAllByText("2 hrs")).toHaveLength(3);

    // Verify dynamic progress text
    expect(screen.getByText("MOD-2 In Progress")).toBeDefined();
  });

  it("handles module click selectors correctly", () => {
    const modulesData = [
      {
        id: "mod-1",
        moduleNo: 1,
        title: "Module 1",
        description: "Introductory module",
        isCompleted: false,
        progressPercentage: 0,
      },
    ];

    const onSelectModuleMock = vi.fn();

    const { rerender } = render(
      <MemoryRouter>
        <LevelModuleList
          modules={modulesData as unknown as Parameters<typeof LevelModuleList>[0]["modules"]}
          levelId="lvl-1"
          onSelectModule={onSelectModuleMock}
        />
      </MemoryRouter>,
    );

    // Trigger learning button click
    const btn = screen.getByText("Start Learning");
    fireEvent.click(btn);
    expect(onSelectModuleMock).toHaveBeenCalledWith(1, "engage");

    // Rerender without select callback to check navigation fallback
    rerender(
      <MemoryRouter>
        <LevelModuleList
          modules={modulesData as unknown as Parameters<typeof LevelModuleList>[0]["modules"]}
          levelId="lvl-1"
        />
      </MemoryRouter>,
    );

    const btnNav = screen.getByText("Start Learning");
    fireEvent.click(btnNav);
    expect(mockNavigate).toHaveBeenCalledWith("/my-courses/lvl-1/modules/1?stage=engage");
  });

  it("shows course completed when all modules are complete", () => {
    const modulesData = [
      {
        id: "mod-1",
        moduleNo: 1,
        title: "Module 1",
        description: "Introductory module",
        isCompleted: true,
        progressPercentage: 100,
      },
    ];

    render(
      <MemoryRouter>
        <LevelModuleList
          modules={modulesData as unknown as Parameters<typeof LevelModuleList>[0]["modules"]}
          levelId="lvl-1"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Course Completed")).toBeDefined();
    expect(screen.getByText("Congratulations! You have completed this course")).toBeDefined();
  });
});
