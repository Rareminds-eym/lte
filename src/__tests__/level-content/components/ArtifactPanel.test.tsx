import { render, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ModuleArtifact } from "@/entities/course";
import { ArtifactPanel } from "@/pages/level-content/ui/components/ArtifactPanel";

const state = vi.hoisted(() => ({ completionKey: null as string | null }));
vi.mock("@/features/submit-artifact", () => ({
  useSubmissionEvaluation: () => ({
    data: { success: true, evaluation: null },
    isFetching: false,
    completionKey: state.completionKey,
  }),
}));
vi.mock("@/pages/level-content/ui/components/ArtifactSubmitTab", () => ({
  ArtifactSubmitTab: () => null,
}));
vi.mock("@/pages/level-content/ui/components/ArtifactFeedbackTab", () => ({
  ArtifactFeedbackTab: () => null,
}));
const artifact: ModuleArtifact = {
  id: "artifact",
  artifactType: "final",
  totalScore: 100,
  passingScore: 60,
  isActive: true,
  questions: [],
  templates: [],
  submittedFiles: [],
  submittedAttempts: [
    {
      submissionId: "submission",
      attemptNo: 1,
      versionLabel: "v1",
      isLatest: true,
      submittedAt: "2026-10-09T00:00:00Z",
    },
  ],
};
const props = {
  activeArtifact: artifact,
  activeArtifactType: "final" as const,
  rightPanelTitle: "Final review",
  expandedArtifactQuestionId: null,
  setExpandedArtifactQuestionId: vi.fn(),
};
beforeEach(() => {
  state.completionKey = null;
});
it("notifies the page once when the latest final review completes", async () => {
  const notify = vi.fn();
  const view = render(<ArtifactPanel {...props} onReviewCompleted={notify} />);
  state.completionKey = "learner:submission:completed";
  view.rerender(<ArtifactPanel {...props} onReviewCompleted={notify} />);
  await waitFor(() => expect(notify).toHaveBeenCalledWith(state.completionKey));
  view.rerender(<ArtifactPanel {...props} onReviewCompleted={notify} />);
  expect(notify).toHaveBeenCalledTimes(1);
});
it.each(["practice", "historical"])("does not redirect from a %s review", async (kind) => {
  const notify = vi.fn();
  const input =
    kind === "practice"
      ? { ...props, activeArtifactType: "practice" as const }
      : {
          ...props,
          activeArtifact: {
            ...artifact,
            submittedAttempts: artifact.submittedAttempts?.map((attempt) => ({
              ...attempt,
              isLatest: false,
            })),
          },
        };
  const view = render(<ArtifactPanel {...input} onReviewCompleted={notify} />);
  state.completionKey = "learner:submission:completed";
  view.rerender(<ArtifactPanel {...input} onReviewCompleted={notify} />);
  expect(notify).not.toHaveBeenCalled();
});
it("allows reopening already completed feedback without an automatic redirect", () => {
  state.completionKey = "learner:submission:completed";
  const notify = vi.fn();
  render(<ArtifactPanel {...props} onReviewCompleted={notify} />);
  expect(notify).not.toHaveBeenCalled();
});
