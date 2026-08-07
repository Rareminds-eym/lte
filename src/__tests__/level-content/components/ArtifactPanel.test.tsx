import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleArtifact } from "@/entities/course";
import { ArtifactPanel } from "@/pages/level-content/ui/components/ArtifactPanel";

const getSubmissionEvaluationMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/submit-artifact", () => ({
  getSubmissionEvaluation: getSubmissionEvaluationMock,
  useSubmitArtifact: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

const telemetry = {
  timestamp: "2026-08-06T09:13:51.455Z",
  latencyMs: 1234,
  modelUsed: "meta-llama/llama-3.3-70b-instruct:free",
  provider: "openrouter",
  rawPromptContent: JSON.stringify(
    [
      { role: "system", content: "You are an expert AI evaluator for the LTE framework." },
      { role: "user", content: 'Evaluate this learner artifact submission:\n{"answers":[]}' },
    ],
    null,
    2,
  ),
  rawResponseContent: '{"overallScore":85}',
  stage1Check: { isAssessable: true, notes: "Submission check passed." },
  stage2Failures: { hasFailure: false, failuresFound: [] },
  wasDecisionOverridden: false,
  validatedDecision: "pass",
  calculatedXp: 20,
};

const submittedFile = {
  id: "file-1",
  submissionId: "submission-1",
  questionId: "question-1",
  fileName: "readiness.xlsx",
  fileType: "xlsx",
  fileSizeBytes: 1024,
  downloadUrl: "/api/v1/artifacts/files/file-1/download",
  attemptNo: 1,
  versionLabel: "v1",
  isLatest: true,
  submittedAt: "2026-08-06T09:13:51.455Z",
  uploadedAt: "2026-08-06T09:13:51.455Z",
};

const artifact: ModuleArtifact = {
  id: "artifact-1",
  artifactType: "final",
  totalScore: 10,
  passingScore: 6,
  questions: [],
  templates: [],
  submittedFiles: [submittedFile],
  isActive: true,
};

function renderPanel() {
  return render(
    <ArtifactPanel
      activeArtifact={artifact}
      activeArtifactType="final"
      rightPanelTitle="Final Artifact"
      expandedArtifactQuestionId={null}
      setExpandedArtifactQuestionId={vi.fn()}
    />,
  );
}

describe("ArtifactPanel historical evaluation + AiDebugInspector", () => {
  beforeEach(() => {
    getSubmissionEvaluationMock.mockReset();
  });

  it("fetches the stored evaluation and renders the AI debug inspector with telemetry", async () => {
    getSubmissionEvaluationMock.mockResolvedValue({
      success: true,
      evaluation: {
        id: "flow-1",
        submission_id: "submission-1",
        stage: "ai",
        status: "completed",
        score: 85,
        decision: "pass",
        feedback: "Pass: All essential criteria demonstrated.",
        improvements: "Add more evidence.",
        completed_at: "2026-08-06T09:13:51.455Z",
        rubric_rows: [],
        calculated_xp: 20,
        debug_telemetry: telemetry,
      },
    });

    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: /feedback/i }));

    await waitFor(() => {
      expect(getSubmissionEvaluationMock).toHaveBeenCalledWith("submission-1");
    });
    expect(await screen.findByText(/Dev AI Inspector/)).toBeInTheDocument();
    expect(
      screen.getByText(/meta-llama\/llama-3.3-70b-instruct:free \(1234ms\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("Copy Debug JSON")).toBeInTheDocument();
  });

  it("shows a copy button for the raw prompt and copies its content", async () => {
    getSubmissionEvaluationMock.mockResolvedValue({
      success: true,
      evaluation: {
        id: "flow-1",
        submission_id: "submission-1",
        stage: "ai",
        status: "completed",
        score: 85,
        decision: "pass",
        feedback: "Pass: All essential criteria demonstrated.",
        improvements: "Add more evidence.",
        completed_at: "2026-08-06T09:13:51.455Z",
        rubric_rows: [],
        calculated_xp: 20,
        debug_telemetry: telemetry,
      },
    });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: /feedback/i }));
    await screen.findByText(/Dev AI Inspector/);
    fireEvent.click(screen.getByRole("button", { name: /Dev AI Inspector/i }));
    fireEvent.click(screen.getByRole("button", { name: /System Prompt & Payload/i }));
    const copyPrompt = screen.getByRole("button", { name: /Copy Prompt/i });
    expect(copyPrompt).toBeInTheDocument();
    fireEvent.click(copyPrompt);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('"role": "system"'));
    });

    fireEvent.click(screen.getByRole("button", { name: /Raw Response/i }));
    fireEvent.click(screen.getByRole("button", { name: /Copy Response/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('"overallScore":85'));
    });
  });

  it("does not render the inspector when the stored evaluation has no telemetry", async () => {
    getSubmissionEvaluationMock.mockResolvedValue({
      success: true,
      evaluation: null,
    });

    renderPanel();
    fireEvent.click(screen.getByRole("tab", { name: /feedback/i }));

    await waitFor(() => {
      expect(getSubmissionEvaluationMock).toHaveBeenCalledWith("submission-1");
    });
    expect(screen.queryByText(/Dev AI Inspector/)).not.toBeInTheDocument();
  });
});
