import type React from "react";
import { useMemo, useState } from "react";
import type { ModuleArtifact, ModuleArtifactSubmittedFile } from "@/entities/course";
import type {
  SubmissionEvaluationResponse,
  SubmitArtifactResponse,
} from "@/features/submit-artifact";
import { useSubmissionEvaluation } from "@/features/submit-artifact";
import { ArtifactGuidanceIcon, ArtifactsIcon, Button, LabFlaskIcon } from "@/shared/ui";
import { ArtifactFeedbackTab, type SubmittedArtifactAttempt } from "./ArtifactFeedbackTab";
import { ArtifactSubmitTab } from "./ArtifactSubmitTab";

interface ArtifactPanelProps {
  activeArtifact: ModuleArtifact | null | undefined;
  activeArtifactType: "practice" | "final" | null;
  rightPanelTitle: string;
  isPanelExpanded?: boolean;
  expandedArtifactQuestionId: string | null | undefined;
  setExpandedArtifactQuestionId: React.Dispatch<React.SetStateAction<string | null | undefined>>;
  onXpEarned?: (xpAmount: number, eventType: string) => void;
  onArtifactSubmitted?: (artifactId: string) => void;
}

/**
 * Maps a stored evaluation flow (GET /submissions/[id]/evaluation) onto the
 * attempt shape the feedback tab renders. Returns undefined while the flow is
 * pending or absent so the UI never fabricates results.
 */
const toAttemptEvaluation = (
  evaluation: NonNullable<SubmissionEvaluationResponse["evaluation"]> | null,
): SubmittedArtifactAttempt["evaluation"] | undefined => {
  if (evaluation?.status !== "completed" || evaluation.score === null) {
    return undefined;
  }
  return {
    overall_score: evaluation.score,
    decision: evaluation.decision ?? "human_review",
    rubric_rows: evaluation.rubric_rows,
    feedback: evaluation.feedback ?? "",
    improvements: evaluation.improvements ?? "",
    calculated_xp: evaluation.calculated_xp,
  };
};

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  activeArtifact,
  activeArtifactType,
  rightPanelTitle,
  isPanelExpanded = false,
  expandedArtifactQuestionId,
  setExpandedArtifactQuestionId,
  onXpEarned,
  onArtifactSubmitted,
}) => {
  const [submittedFilesByArtifactId, setSubmittedFilesByArtifactId] = useState<
    Record<string, ModuleArtifactSubmittedFile[]>
  >({});
  const [activeArtifactTab, setActiveArtifactTab] = useState<"submit" | "feedback">("submit");
  const [activeFeedbackAttemptNo, setActiveFeedbackAttemptNo] = useState<number | null>(null);

  const submittedFileVersions = useMemo(() => {
    const baseFiles = activeArtifact?.submittedFiles ?? [];
    const localFiles = activeArtifact ? (submittedFilesByArtifactId[activeArtifact.id] ?? []) : [];
    const syncedBaseFiles = localFiles.length
      ? baseFiles.map((file) => ({ ...file, isLatest: false }))
      : baseFiles;
    return [...syncedBaseFiles, ...localFiles];
  }, [activeArtifact, submittedFilesByArtifactId]);

  const submittedAttempts = useMemo<SubmittedArtifactAttempt[]>(() => {
    const attemptsByNo = new Map<number, SubmittedArtifactAttempt>();

    for (const file of submittedFileVersions) {
      const existing = attemptsByNo.get(file.attemptNo);
      if (existing) {
        existing.files.push(file);
        existing.isLatest = existing.isLatest || file.isLatest;
        existing.submittedAt = existing.submittedAt ?? file.submittedAt ?? file.uploadedAt;
        continue;
      }

      attemptsByNo.set(file.attemptNo, {
        attemptNo: file.attemptNo,
        versionLabel: file.versionLabel,
        isLatest: file.isLatest,
        submittedAt: file.submittedAt ?? file.uploadedAt,
        files: [file],
      });
    }

    return [...attemptsByNo.values()].sort((a, b) => b.attemptNo - a.attemptNo);
  }, [submittedFileVersions]);

  const selectedAttempt =
    submittedAttempts.find(
      (attempt) =>
        attempt.attemptNo === (activeFeedbackAttemptNo ?? submittedAttempts[0]?.attemptNo),
    ) ?? null;
  const selectedSubmissionId = selectedAttempt?.files[0]?.submissionId;
  const { data: storedEvaluation, isFetching: isStoredEvaluationFetching } =
    useSubmissionEvaluation(selectedSubmissionId);
  const latestEvaluation = toAttemptEvaluation(storedEvaluation?.evaluation ?? null);

  if (!activeArtifact || !activeArtifactType) {
    return (
      <div className="rounded-xl border border-line-default bg-surface-primary p-4 shadow-2xs">
        <h4 className="text-sm font-bold text-content-primary">{rightPanelTitle}</h4>
        <p className="mt-2 text-[13px] leading-relaxed text-content-secondary">
          This artifact is not configured for this stage yet.
        </p>
      </div>
    );
  }

  const isPractice = activeArtifact.artifactType === "practice";
  const artifactHeading = isPractice ? "Practice Artifact" : "Final Artifact";
  const ArtifactIcon = isPractice ? LabFlaskIcon : ArtifactsIcon;
  const GuidanceIcon = isPractice ? LabFlaskIcon : ArtifactGuidanceIcon;
  const firstQuestionId = activeArtifact.questions[0]?.id ?? null;
  const activeQuestionId =
    expandedArtifactQuestionId === undefined
      ? firstQuestionId
      : expandedArtifactQuestionId &&
          activeArtifact.questions.some((question) => question.id === expandedArtifactQuestionId)
        ? expandedArtifactQuestionId
        : null;
  const hasSubmittedArtifact = submittedAttempts.length > 0;
  const visibleArtifactTab =
    activeArtifactTab === "feedback" && hasSubmittedArtifact ? "feedback" : "submit";

  const handleSubmitted = (response: SubmitArtifactResponse) => {
    const submittedAt = response.submitted_at ?? new Date().toISOString();
    const submittedFiles = response.files.map((file) => ({
      id: file.file_id,
      submissionId: response.submission_id,
      questionId: file.question_id,
      fileName: file.file_name,
      fileType: file.file_name.includes(".") ? (file.file_name.split(".").pop() ?? "file") : "file",
      fileSizeBytes: null,
      downloadUrl: `/api/v1/artifacts/files/${file.file_id}/download`,
      attemptNo: response.attempt_no,
      versionLabel: response.version_label,
      isLatest: true,
      submittedAt,
      uploadedAt: submittedAt,
    }));
    setSubmittedFilesByArtifactId((current) => ({
      ...current,
      [activeArtifact.id]: [
        ...(current[activeArtifact.id] ?? []).map((file) => ({ ...file, isLatest: false })),
        ...submittedFiles,
      ],
    }));
    setActiveFeedbackAttemptNo(response.attempt_no);
    setActiveArtifactTab("feedback");
    onArtifactSubmitted?.(activeArtifact.id);

    // Show XP modal if XP was awarded
    if (response.evaluation?.calculated_xp !== undefined && response.evaluation.calculated_xp > 0) {
      const eventType = response.evaluation.event_type;
      // Only show modal if we have a valid event type from backend
      if (eventType) {
        onXpEarned?.(response.evaluation.calculated_xp, eventType);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-line-default bg-white px-2.5 pb-2.5 pt-3.5 shadow-2xs">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
          <h4
            aria-label={artifactHeading}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
              isPractice
                ? "border-warning-200 bg-warning-50 text-warning-700"
                : "border-brand-100 bg-brand-50 text-brand-600"
            }`}
          >
            <ArtifactIcon aria-hidden="true" size={12} className="shrink-0" />
            {artifactHeading}
          </h4>
          <div className="flex flex-wrap justify-end gap-1.5 text-[11px] font-medium text-content-secondary">
            <span className="rounded-full border border-line-default bg-white px-2.5 py-0.5">
              Pass: {activeArtifact.passingScore ?? "-"} / {activeArtifact.totalScore}
            </span>
            <span className="rounded-full border border-line-default bg-white px-2.5 py-0.5">
              {activeArtifact.questions.length} question
              {activeArtifact.questions.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div
          className="mt-3 flex border-b border-line-default"
          role="tablist"
          aria-label="Artifact panel"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={visibleArtifactTab === "submit"}
            className={`relative -mb-px h-10 flex-1 cursor-pointer rounded-none border-0 border-b-2 bg-transparent px-3 py-0 text-[13px] font-bold shadow-none transition hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
              visibleArtifactTab === "submit"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-content-muted hover:text-content-primary"
            }`}
            onClick={() => setActiveArtifactTab("submit")}
          >
            Submit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={visibleArtifactTab === "feedback"}
            disabled={!hasSubmittedArtifact}
            className={`relative -mb-px inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-none border-0 border-b-2 bg-transparent px-3 py-0 text-[13px] font-bold shadow-none transition hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${
              visibleArtifactTab === "feedback"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-content-muted hover:text-content-primary"
            }`}
            onClick={() => setActiveArtifactTab("feedback")}
          >
            Feedback
            <span
              className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none ${
                visibleArtifactTab === "feedback"
                  ? "bg-brand-600 text-white"
                  : "bg-surface-secondary text-content-muted"
              }`}
            >
              {submittedAttempts.length}
            </span>
          </Button>
        </div>

        {visibleArtifactTab === "submit" ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-md border-l-4 border-l-brand-600 bg-brand-50 px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-brand-700">
            <GuidanceIcon size={20} className="shrink-0 text-brand-700" />
            <span>
              {isPractice
                ? "Complete this practice artifact to understand the concepts."
                : "Build and submit your final evaluated artifact."}
            </span>
          </div>
        ) : null}
      </div>

      {visibleArtifactTab === "feedback" ? (
        <ArtifactFeedbackTab
          submittedAttempts={submittedAttempts}
          activeFeedbackAttemptNo={activeFeedbackAttemptNo}
          isPanelExpanded={isPanelExpanded}
          onSelectAttempt={setActiveFeedbackAttemptNo}
          latestEvaluation={latestEvaluation}
          isEvaluationLoading={isStoredEvaluationFetching}
        />
      ) : null}

      {visibleArtifactTab === "submit" ? (
        <ArtifactSubmitTab
          activeArtifact={activeArtifact}
          artifactTemplates={activeArtifact.templates}
          activeQuestionId={activeQuestionId}
          setExpandedArtifactQuestionId={setExpandedArtifactQuestionId}
          submittedFiles={submittedFileVersions}
          onSubmitted={handleSubmitted}
        />
      ) : null}
    </div>
  );
};
