import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LevelModulesPage } from "@/pages/level-modules";
import * as courseExports from "@/entities/course";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("LevelModulesPage", () => {
  it("renders level modules page with dynamic hook resolution", async () => {
    const queryClient = createTestQueryClient();

    vi.spyOn(courseExports, "useLevelDetails").mockReturnValue({
      data: {
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
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof courseExports.useLevelDetails>);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/courses/HTT-IND-CAP-01/levels/0a010796-10c0-5287-b89a-6ab56bd71399"]}>
          <Routes>
            <Route
              path="/courses/:capabilityCode/levels/:levelId"
              element={<LevelModulesPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const titles = await screen.findAllByText("Guided Guest and Visitor Arrival Readiness");
    expect(titles.length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Build guided L1 capability to verify guest and visitor arrival readiness/i),
    ).toBeInTheDocument();
  });
});
