import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ArtifactFeedbackTab,
  type SubmittedArtifactAttempt,
} from "@/pages/level-content/ui/components/ArtifactFeedbackTab";

const downloadArtifactFileMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/features/submit-artifact", () => ({
  downloadArtifactFile: (...args: unknown[]) => downloadArtifactFileMock(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: { error: (...args: unknown[]) => toastErrorMock(...args) },
}));

const createAttempt = (
  attemptNo: number,
  evaluation?: SubmittedArtifactAttempt["evaluation"],
): SubmittedArtifactAttempt => ({
  attemptNo,
  versionLabel: `v${attemptNo}`,
  isLatest: attemptNo === 1,
  submittedAt: "2026-08-05T10:00:00.000Z",
  evaluation,
  files: [
    {
      id: `file-${attemptNo}`,
      submissionId: `submission-${attemptNo}`,
      questionId: "question-1",
      fileName: "answer.xlsx",
      fileType: "xlsx",
      fileSizeBytes: null,
      downloadUrl: "/api/v1/artifacts/files/file-1/download",
      attemptNo,
      versionLabel: `v${attemptNo}`,
      isLatest: attemptNo === 1,
      submittedAt: "2026-08-05T10:00:00.000Z",
      uploadedAt: "2026-08-05T10:00:00.000Z",
    },
  ],
});

const baseEvaluation: SubmittedArtifactAttempt["evaluation"] = {
  overall_score: 2.7,
  decision: "pass",
  rubric_rows: [{ label: "Completeness", score: 3, maxScore: 3, level: "Strongly demonstrated" }],
  feedback: "Great work.",
  improvements: "Add more evidence.",
  calculated_xp: 120,
};

const renderTab = (
  overrides: {
    attempts?: SubmittedArtifactAttempt[];
    activeFeedbackAttemptNo?: number | null;
    latestEvaluation?: SubmittedArtifactAttempt["evaluation"];
    isEvaluationLoading?: boolean;
  } = {},
) => {
  const onSelectAttempt = vi.fn();
  const result = render(
    <ArtifactFeedbackTab
      submittedAttempts={overrides.attempts ?? [createAttempt(1, baseEvaluation)]}
      activeFeedbackAttemptNo={overrides.activeFeedbackAttemptNo ?? 1}
      isPanelExpanded={false}
      onSelectAttempt={onSelectAttempt}
      latestEvaluation={overrides.latestEvaluation}
      isEvaluationLoading={overrides.isEvaluationLoading ?? false}
    />,
  );
  return { onSelectAttempt, ...result };
};

describe("ArtifactFeedbackTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    downloadArtifactFileMock.mockResolvedValue(new Blob(["xlsx"]));
  });

  it("renders the decision badge, score, and rubric for a completed evaluation", () => {
    renderTab();

    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getAllByText("2.7").length).toBeGreaterThan(0);
    expect(screen.getByText("Completeness")).toBeInTheDocument();
    expect(screen.getByText("Great work.")).toBeInTheDocument();
    expect(screen.getByText("Add more evidence.")).toBeInTheDocument();
  });

  it("renders failed rubric scores in red", () => {
    renderTab({
      attempts: [
        createAttempt(1, {
          ...baseEvaluation,
          decision: "revise_and_resubmit",
          rubric_rows: [
            {
              label: "Completeness",
              score: 0,
              maxScore: 3,
              level: "Not demonstrated",
              tone: "error",
            },
          ],
        }),
      ],
    });

    expect(screen.getByText("0/3 (Not demonstrated)")).toHaveClass("text-danger-600");
  });

  it("shows a dash for the score and a not-available state when no evaluation exists", () => {
    renderTab({ attempts: [createAttempt(1)] });

    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
    expect(screen.getByText("Not Available")).toBeInTheDocument();
    expect(
      screen.getAllByText("Evaluation not available for this attempt.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Completeness")).not.toBeInTheDocument();
  });

  it("shows the pending state while the evaluation is loading", () => {
    renderTab({ attempts: [createAttempt(1)], isEvaluationLoading: true });

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getAllByText("Evaluation in progress…").length).toBeGreaterThan(0);
  });

  it("falls back to the latest evaluation prop for the selected attempt", () => {
    renderTab({ attempts: [createAttempt(2)], latestEvaluation: baseEvaluation });

    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getAllByText("2.7").length).toBeGreaterThan(0);
  });

  it("downloads the submitted file on click", async () => {
    renderTab();
    const anchorSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByText("answer.xlsx"));

    await waitFor(() =>
      expect(downloadArtifactFileMock).toHaveBeenCalledWith(
        "/api/v1/artifacts/files/file-1/download",
      ),
    );
    expect(anchorSpy).toHaveBeenCalled();
    anchorSpy.mockRestore();
  });

  it("surfaces a toast when the download fails", async () => {
    downloadArtifactFileMock.mockRejectedValue(new Error("File expired."));
    renderTab();

    fireEvent.click(screen.getByText("answer.xlsx"));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("File expired."));
  });

  it("selects a different attempt via the attempt tabs", () => {
    const { onSelectAttempt } = renderTab({
      attempts: [createAttempt(1, baseEvaluation), createAttempt(2)],
      activeFeedbackAttemptNo: 1,
    });

    fireEvent.click(screen.getByText("v2"));

    expect(onSelectAttempt).toHaveBeenCalledWith(2);
  });
});
