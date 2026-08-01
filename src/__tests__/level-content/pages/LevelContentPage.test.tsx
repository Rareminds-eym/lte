import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LevelContentPage } from "@/pages/level-content";

const { useLevelContentDataMock } = vi.hoisted(() => ({
  useLevelContentDataMock: vi.fn(),
}));

const levelId = "0a010796-10c0-5287-b89a-6ab56bd71399";

vi.mock("@/entities/course", async () => {
  const actual = await vi.importActual<typeof import("@/entities/course")>("@/entities/course");
  return {
    ...actual,
    useLevelContentData: (...args: unknown[]) => useLevelContentDataMock(...args),
  };
});

const mockLevelContentData = {
  level: {
    id: "course-1",
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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("LevelContentPage", () => {
  beforeEach(() => {
    useLevelContentDataMock.mockReset();
  });

  it("loads level and module content from the level entity hook", () => {
    useLevelContentDataMock.mockReturnValue({
      data: mockLevelContentData,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(useLevelContentDataMock).toHaveBeenCalledWith(levelId, 1);
    expect(screen.getAllByText("System Failure Investigation")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Incident Signals")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Incident Triage Walkthrough")[0]).toBeInTheDocument();
    expect(screen.getByText("How to isolate useful signals.")).toBeInTheDocument();
  });

  it("uses the stage query parameter to select stage content", () => {
    useLevelContentDataMock.mockReturnValue({
      data: mockLevelContentData,
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

  it("shows the practice artifact drawer for the Express stage", () => {
    useLevelContentDataMock.mockReturnValue({
      data: mockLevelContentData,
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
    useLevelContentDataMock.mockReturnValue({
      data: mockLevelContentData,
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

  it("shows an error state when the API fails", () => {
    useLevelContentDataMock.mockReturnValue({
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
