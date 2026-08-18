import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LevelContentPage } from "@/pages/level-content";

const {
  fetchLevelModuleDetailsMock,
  useLevelDetailsMock,
  useLevelModuleDetailsMock,
  useStartModuleProgressMock,
  useUpdateStageProgressMock,
} = vi.hoisted(() => ({
  fetchLevelModuleDetailsMock: vi.fn(),
  useLevelDetailsMock: vi.fn(),
  useLevelModuleDetailsMock: vi.fn(),
  useStartModuleProgressMock: vi.fn(),
  useUpdateStageProgressMock: vi.fn(),
}));

const levelId = "0a010796-10c0-5287-b89a-6ab56bd71399";

vi.mock("@/entities/course", async () => {
  const actual = await vi.importActual<typeof import("@/entities/course")>("@/entities/course");
  return {
    ...actual,
    fetchLevelModuleDetails: (...args: unknown[]) => fetchLevelModuleDetailsMock(...args),
    useLevelDetails: (...args: unknown[]) => useLevelDetailsMock(...args),
    useLevelModuleDetails: (...args: unknown[]) => useLevelModuleDetailsMock(...args),
    useStartModuleProgress: (...args: unknown[]) => useStartModuleProgressMock(...args),
    useUpdateStageProgress: (...args: unknown[]) => useUpdateStageProgressMock(...args),
  };
});

const mockLevelContentData = {
  level: {
    id: "course-1",
    capabilityCode: "BCP-CAP-CM-002",
    levelCode: "crs-sys-fail-inv",
    title: "System Failure Investigation",
    description: "Investigate production incidents.",
    levelProblemStatement: {
      title: "System Failure Investigation",
      description: "A production incident needs evidence-led investigation.",
    },
    observableBehavior: "Diagnoses failures.",
    exampleOutputs: "Incident review.",
    durationMinutes: 120,
    difficultyLevel: "intermediate",
    levelStatus: "published",
    versionNo: 1,
    modules: [
      {
        id: "module-1",
        moduleNo: 1,
        title: "Incident Signals",
        description: "Read logs and symptoms.",
        isPublished: true,
      },
      {
        id: "module-2",
        moduleNo: 2,
        title: "Root Cause",
        description: "Validate the likely cause.",
        isPublished: true,
      },
    ],
  },
  module: {
    id: "module-1",
    levelId: "course-1",
    levelCode: "crs-sys-fail-inv",
    levelTitle: "System Failure Investigation",
    moduleNo: 1,
    title: "Incident Signals",
    description: "Read logs and symptoms.",
    moduleProblemStatement: "A production service is failing intermittently.",
    pressurePoints: ["Customer pressure"],
    userConfusion: ["May skip evidence"],
    industryChallenge: null,
    prerequisites: ["Basic debugging knowledge."],
    whatYoullLearn: ["How to isolate useful signals."],
    whenToApply: "During production incidents.",
    support: {},
    knowledge: {},
    tools: {},
    learningContent: {},
    stages: [
      {
        id: "stage-engage",
        stageName: "engage",
        stageOrder: 1,
        stageDescription: "Understand the incident context before taking action.",
        isActive: true,
        items: [
          {
            id: "content-1",
            contentType: "video",
            title: "Incident Triage Walkthrough",
            description: "A guided triage flow.",
            url: "https://example.com/triage",
            sortOrder: 1,
            durationSeconds: 300,
            xpReward: 20,
            mimeType: null,
            fileSizeBytes: null,
            status: "published",
          },
        ],
        artifacts: [],
      },
      {
        id: "stage-explore",
        stageName: "explore",
        stageOrder: 2,
        stageDescription: "Explore incident signals and evidence.",
        isActive: true,
        items: [],
        artifacts: [],
      },
      {
        id: "stage-express",
        stageName: "express",
        stageOrder: 4,
        stageDescription: "Draft the practice artifact from the observed evidence.",
        isActive: true,
        items: [],
        artifacts: [
          {
            id: "artifact-1",
            artifactType: "practice",
            totalScore: 20,
            passingScore: 12,
            isActive: true,
            questions: [
              {
                id: "question-1",
                questionOrder: 1,
                title: "Complete the Evidence Note",
                description: "Capture the safe handoff evidence.",
                instructions: {
                  required_fields: "Required fields include facts, risks, and owner.",
                  pass_criteria: "Evidence is separated from assumptions.",
                  critical_fail: "The learner approves access without authority.",
                },
              },
            ],
            templates: [
              {
                id: "template-1",
                questionId: "question-1",
                fileName: "Practice_Artifact.xlsx",
                fileUrl: "https://example.com/template.xlsx",
                fileType: "excel",
                version: 1,
                isDownloadable: true,
              },
            ],
          },
        ],
      },
      {
        id: "stage-evolve",
        stageName: "evolve",
        stageOrder: 6,
        stageDescription: "Submit the final artifact when the course requires it here.",
        isActive: true,
        items: [],
        artifacts: [
          {
            id: "artifact-final-1",
            artifactType: "final",
            totalScore: 20,
            passingScore: 12,
            isActive: true,
            questions: [
              {
                id: "question-final-1",
                questionOrder: 1,
                title: "Complete the Final Evidence Pack",
                description: "Submit final validated evidence.",
                instructions: {
                  required_fields: "Required fields include final proof and role boundary.",
                  pass_criteria: "Final evidence is complete.",
                  critical_fail: "The learner submits without evidence.",
                },
              },
            ],
            templates: [],
          },
        ],
      },
    ],
  },
};

const renderPage = (path = `/my-courses/${levelId}/modules/1`) => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/my-courses/:levelId/modules/:moduleNo" element={<LevelContentPage />} />
          <Route
            path="/my-courses/:capabilityCode"
            element={<div data-testid="course-overview-route" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("LevelContentPage", () => {
  beforeEach(() => {
    fetchLevelModuleDetailsMock.mockResolvedValue(mockLevelContentData.module);
    useLevelDetailsMock.mockReset();
    useLevelModuleDetailsMock.mockReset();
    useStartModuleProgressMock.mockReturnValue({ mutate: vi.fn() });
    useUpdateStageProgressMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it("loads level and module content from the level entity hook", () => {
    useLevelDetailsMock.mockReturnValue({
      data: mockLevelContentData.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: mockLevelContentData.module,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(useLevelDetailsMock).toHaveBeenCalledWith(levelId);
    expect(useLevelModuleDetailsMock).toHaveBeenCalledWith(levelId, 1);
    expect(screen.getAllByText("System Failure Investigation")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Incident Signals")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Incident Triage Walkthrough")[0]).toBeInTheDocument();
    expect(screen.getByText("How to isolate useful signals.")).toBeInTheDocument();
  });

  it("keeps the module review shell visible while module content loads", () => {
    useLevelDetailsMock.mockReturnValue({
      data: mockLevelContentData.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getAllByText("Incident Signals")[0]).toBeInTheDocument();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    expect(screen.queryByText("Incident Triage Walkthrough")).not.toBeInTheDocument();
  });

  it("uses the stage query parameter to select stage content", () => {
    const data = {
      ...mockLevelContentData,
      module: {
        ...mockLevelContentData.module,
        completedStages: ["engage"],
      },
    };
    useLevelDetailsMock.mockReturnValue({
      data: data.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: data.module,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage(`/my-courses/${levelId}/modules/1?stage=explore`);

    expect(screen.getAllByText("Explore")[0]).toBeInTheDocument();
    expect(
      screen.getByText("No learning content is available for this stage yet."),
    ).toBeInTheDocument();
  });

  it("moves to the next stage after Mark Done & Next completes", async () => {
    useLevelDetailsMock.mockReturnValue({
      data: mockLevelContentData.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: mockLevelContentData.module,
      isLoading: false,
      isError: false,
      error: null,
    });
    useUpdateStageProgressMock.mockReturnValue({
      mutate: vi.fn((_params, options) => {
        options?.onSuccess?.({
          success: true,
          stageProgressId: "stage-progress-1",
          stagesCompleted: 1,
          completionPercentage: 16,
          xpAwarded: 0,
          totalXp: 0,
        });
      }),
      isPending: false,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Mark Done & Next/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Explore")[0]).toBeInTheDocument();
    });
    expect(
      screen.getByText("No learning content is available for this stage yet."),
    ).toBeInTheDocument();
  });

  it("shows the practice artifact drawer for the Express stage", () => {
    const data = {
      ...mockLevelContentData,
      module: {
        ...mockLevelContentData.module,
        completedStages: ["engage", "explore", "explain"],
      },
    };
    useLevelDetailsMock.mockReturnValue({
      data: data.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: data.module,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage(`/my-courses/${levelId}/modules/1?stage=express`);

    expect(screen.getByRole("heading", { name: "Practice Artifact" })).toBeInTheDocument();
    expect(screen.getAllByText("Complete the Evidence Note").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Required fields include facts, risks, and owner."),
    ).toBeInTheDocument();
    expect(screen.getByText("Practice_Artifact.xlsx")).toBeInTheDocument();
  });

  it("shows a final artifact drawer for any stage that has a final artifact", () => {
    const data = {
      ...mockLevelContentData,
      module: {
        ...mockLevelContentData.module,
        completedStages: ["engage", "explore", "explain", "express", "empower"],
      },
    };
    useLevelDetailsMock.mockReturnValue({
      data: data.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: data.module,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage(`/my-courses/${levelId}/modules/1?stage=evolve`);

    expect(screen.getByRole("heading", { name: "Final Artifact" })).toBeInTheDocument();
    expect(screen.getByText("Complete the Final Evidence Pack")).toBeInTheDocument();
    expect(
      screen.getByText("Required fields include final proof and role boundary."),
    ).toBeInTheDocument();
  });

  it("navigates to the next module from a completed final stage", () => {
    const data = {
      ...mockLevelContentData,
      module: {
        ...mockLevelContentData.module,
        progressPercentage: 100,
        completedStages: ["engage", "explore", "explain", "express", "empower", "evolve"],
        stages: mockLevelContentData.module.stages.map((stage) =>
          stage.stageName === "evolve"
            ? {
                ...stage,
                artifacts: stage.artifacts.map((artifact) =>
                  artifact.artifactType === "final"
                    ? {
                        ...artifact,
                        submittedFiles: [
                          {
                            id: "file-final-1",
                            submissionId: "submission-final-1",
                            questionId: "question-final-1",
                            fileName: "Final_Evidence_Pack.xlsx",
                            fileType: "xlsx",
                            fileSizeBytes: 1024,
                            downloadUrl: "/api/v1/artifacts/files/file-final-1/download",
                            attemptNo: 1,
                            versionLabel: "v1",
                            isLatest: true,
                            submittedAt: "2026-08-17T00:00:00.000Z",
                            uploadedAt: "2026-08-17T00:00:00.000Z",
                          },
                        ],
                      }
                    : artifact,
                ),
                items: [
                  {
                    id: "content-final-review",
                    contentType: "slide",
                    title: "Final Review",
                    description: "Review before moving ahead.",
                    url: "https://example.com/final-review",
                    sortOrder: 1,
                    durationSeconds: 120,
                    xpReward: 0,
                    mimeType: null,
                    fileSizeBytes: null,
                    status: "published",
                  },
                ],
              }
            : stage,
        ),
      },
    };
    useLevelDetailsMock.mockReturnValue({
      data: data.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: data.module,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage(`/my-courses/${levelId}/modules/1?stage=evolve`);

    fireEvent.click(screen.getByRole("button", { name: /Next Module/i }));

    expect(useLevelModuleDetailsMock).toHaveBeenCalledWith(levelId, 2);
  });

  it("blocks forward progress after an unsubmitted final artifact stage", () => {
    const data = {
      ...mockLevelContentData,
      module: {
        ...mockLevelContentData.module,
        completedStages: ["engage", "explore", "explain"],
        stages: mockLevelContentData.module.stages.map((stage) =>
          stage.stageName === "express"
            ? {
                ...stage,
                items: [
                  {
                    id: "content-express-final",
                    contentType: "slide",
                    title: "Final Artifact Instructions",
                    description: "Submit before moving forward.",
                    url: "https://example.com/final-artifact",
                    sortOrder: 1,
                    durationSeconds: 120,
                    xpReward: 0,
                    mimeType: null,
                    fileSizeBytes: null,
                    status: "published",
                  },
                ],
                artifacts: stage.artifacts.map((artifact) => ({
                  ...artifact,
                  artifactType: "final",
                  id: "artifact-final-express",
                })),
              }
            : stage,
        ),
      },
    };
    useLevelDetailsMock.mockReturnValue({
      data: data.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: data.module,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage(`/my-courses/${levelId}/modules/1?stage=express`);

    expect(screen.getByRole("button", { name: /Mark Done & Next/i })).toBeDisabled();
    screen.getAllByRole("button", { name: /evolve/i }).forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("returns to the capability overview when the final module is complete", () => {
    const data = {
      level: {
        ...mockLevelContentData.level,
        modules: [mockLevelContentData.level.modules[0]],
      },
      module: {
        ...mockLevelContentData.module,
        progressPercentage: 100,
        completedStages: ["engage", "explore", "explain", "express", "empower", "evolve"],
        stages: mockLevelContentData.module.stages.map((stage) =>
          stage.stageName === "evolve"
            ? {
                ...stage,
                artifacts: stage.artifacts.map((artifact) =>
                  artifact.artifactType === "final"
                    ? {
                        ...artifact,
                        submittedFiles: [
                          {
                            id: "file-final-1",
                            submissionId: "submission-final-1",
                            questionId: "question-final-1",
                            fileName: "Final_Evidence_Pack.xlsx",
                            fileType: "xlsx",
                            fileSizeBytes: 1024,
                            downloadUrl: "/api/v1/artifacts/files/file-final-1/download",
                            attemptNo: 1,
                            versionLabel: "v1",
                            isLatest: true,
                            submittedAt: "2026-08-17T00:00:00.000Z",
                            uploadedAt: "2026-08-17T00:00:00.000Z",
                          },
                        ],
                      }
                    : artifact,
                ),
                items: [
                  {
                    id: "content-final-review",
                    contentType: "slide",
                    title: "Final Review",
                    description: "Review before finishing.",
                    url: "https://example.com/final-review",
                    sortOrder: 1,
                    durationSeconds: 120,
                    xpReward: 0,
                    mimeType: null,
                    fileSizeBytes: null,
                    status: "published",
                  },
                ],
              }
            : stage,
        ),
      },
    };
    useLevelDetailsMock.mockReturnValue({
      data: data.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: data.module,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage(`/my-courses/${levelId}/modules/1?stage=evolve`);

    fireEvent.click(screen.getByRole("button", { name: /Complete Course/i }));

    expect(screen.getByTestId("course-overview-route")).toBeInTheDocument();
  });

  it("handles toggling modules drawer and expanding/collapsing stage info", async () => {
    const data = {
      level: mockLevelContentData.level,
      module: {
        ...mockLevelContentData.module,
        stages: [
          {
            id: "stage-engage",
            stageName: "engage",
            stageOrder: 1,
            stageDescription: "Understand the context.",
            isActive: true,
            items: [
              {
                id: "content-1",
                contentType: "video",
                title: "Walkthrough",
                url: "https://example.com/v",
              },
              {
                id: "content-2",
                contentType: "document",
                title: "Doc details",
                url: "https://example.com/doc",
              },
            ],
            artifacts: [
              {
                artifactType: "practice",
                passingScore: 8,
                totalScore: 10,
                questions: [
                  {
                    id: "q-1",
                    questionOrder: 1,
                    title: "Practice Question",
                    description: "Solve it.",
                    instructions: "Do it well.",
                  },
                ],
                templates: [
                  {
                    id: "t-1",
                    questionId: "q-1",
                    fileName: "template.xlsx",
                    fileUrl: "https://example.com/t.xlsx",
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    useLevelDetailsMock.mockReturnValue({
      data: data.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: data.module,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage(`/my-courses/${levelId}/modules/1?stage=engage`);

    // Wait for the main page to load
    await screen.findByText("Incident Signals");

    // Click resource tab to switch selected content
    const docTab = screen.getByRole("button", { name: "Doc details" });
    fireEvent.click(docTab);

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    expect(screen.queryByLabelText("Download selected resource")).not.toBeInTheDocument();

    // Click expand resource button
    const expandBtn = screen.getByLabelText("Expand selected resource");
    fireEvent.click(expandBtn);

    // Expand stage info right-panel check
    const expandInfoBtn = screen.getByLabelText("Expand stage info");
    fireEvent.click(expandInfoBtn);

    // Close stage info right-panel check
    const closeInfoBtn = screen.getByLabelText("Close stage info");
    fireEvent.click(closeInfoBtn);

    // Toggling artifact panel question accordion
    const questionBtn = screen.getByText("Practice Question");
    fireEvent.click(questionBtn);

    // Download template template.xlsx click
    const templateBtn = screen.getByText("template.xlsx");
    fireEvent.click(templateBtn);
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com/t.xlsx",
        "_blank",
        "noopener,noreferrer",
      ),
    );

    fireEvent.click(questionBtn);
  });

  it("shows an error state when the API fails", () => {
    useLevelDetailsMock.mockReturnValue({
      data: mockLevelContentData.level,
      isLoading: false,
      isError: false,
      error: null,
    });
    useLevelModuleDetailsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Module 99 for level not found"),
    });

    renderPage(`/my-courses/${levelId}/modules/99`);

    expect(screen.getByText("Course Content Not Available")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This course content is not available right now. Please go back to your courses and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Module 99 for level not found")).not.toBeInTheDocument();
    expect(screen.queryByText("Structured Logging")).not.toBeInTheDocument();
  });
});
