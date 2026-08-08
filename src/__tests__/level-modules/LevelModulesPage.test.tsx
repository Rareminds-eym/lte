import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Course } from "@/entities/course";
import * as courseExports from "@/entities/course";
import { LevelModulesPage } from "@/pages/level-modules";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const levelDetails = {
  id: "0a010796-10c0-5287-b89a-6ab56bd71399",
  levelCode: "HTT_L1",
  capabilityCode: "HTT-IND-CAP-01",
  capabilityName: "Verify guest and visitor arrival readiness",
  title: "Guided Guest and Visitor Arrival Readiness",
  description: "Build guided L1 capability to verify guest and visitor arrival readiness.",
  levelProblemStatement: {
    title: "Guided Guest and Visitor Arrival Readiness",
    description: "A front-office team is preparing for a guest arrival...",
  },
  durationMinutes: 360,
  difficultyLevel: "beginner",
  levelStatus: "published",
  versionNo: 1,
  artifactsCount: 2,
  observableBehavior: {},
  exampleOutputs: {},
  levelNo: 1,
  levelLabel: "Beginner",
  modules: [
    {
      id: "mod-0",
      moduleNo: 0,
      title: "Course Readiness",
      description: "Readiness checklist",
      isPublished: true,
    },
    {
      id: "mod-1",
      moduleNo: 1,
      title: "Case Intake",
      description: "Case intake process",
      isPublished: true,
    },
  ],
} satisfies courseExports.LevelDetailsResponse;

const notStartedCourse = {
  id: "course-1",
  capabilityId: "cap-1",
  capabilityCode: "HTT-IND-CAP-01",
  title: "Guided Guest and Visitor Arrival Readiness",
  description: "Build guided L1 capability to verify guest and visitor arrival readiness.",
  category: "core",
  level: "L1",
  imageUrl: "",
  tags: [],
  status: "not_started",
  progress: 0,
  currentLevel: 0,
  totalLevels: 2,
  targetLevel: "L5",
  durationHours: 4,
  xp: 0,
  priority: "core",
} satisfies Course;

const renderLevelModulesPage = () => {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={["/courses/HTT-IND-CAP-01/levels/0a010796-10c0-5287-b89a-6ab56bd71399"]}
      >
        <Routes>
          <Route path="/courses/:capabilityCode/levels/:levelId" element={<LevelModulesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("LevelModulesPage", () => {
  it("renders level modules page with dynamic hook resolution", async () => {
    vi.spyOn(courseExports, "useLevelDetails").mockReturnValue({
      data: levelDetails,
      isLoading: false,
      error: null,
    } as ReturnType<typeof courseExports.useLevelDetails>);
    vi.spyOn(courseExports, "useCourses").mockReturnValue({
      data: [notStartedCourse],
    } as unknown as ReturnType<typeof courseExports.useCourses>);

    renderLevelModulesPage();

    const titles = await screen.findAllByText("Guided Guest and Visitor Arrival Readiness");
    expect(titles.length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Build guided L1 capability to verify guest and visitor arrival readiness/i),
    ).toBeInTheDocument();
  });

  it("shows learner level progress from the capability endpoint instead of curriculum level number", async () => {
    vi.spyOn(courseExports, "useLevelDetails").mockReturnValue({
      data: levelDetails,
      isLoading: false,
      error: null,
    } as ReturnType<typeof courseExports.useLevelDetails>);
    vi.spyOn(courseExports, "useCourses").mockReturnValue({
      data: [notStartedCourse],
    } as unknown as ReturnType<typeof courseExports.useCourses>);

    renderLevelModulesPage();

    expect(await screen.findByText("Level 0 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Level 1 of 2")).not.toBeInTheDocument();
  });
});
