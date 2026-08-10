import type React from "react";
import { useState } from "react";
import type { ModuleArtifactSubmittedFile } from "@/entities/course";
import { downloadArtifactFile } from "@/features/submit-artifact";
import {
  ArtifactsIcon,
  Button,
  CheckIcon,
  ChevronRightIcon,
  DocumentIcon,
  MessageSquareIcon,
  toast,
} from "@/shared/ui";

export interface SubmittedArtifactAttempt {
  attemptNo: number;
  versionLabel: string;
  isLatest: boolean;
  submittedAt: string | null;
  files: ModuleArtifactSubmittedFile[];
  evaluation?: {
    overall_score: number;
    decision: "pass" | "revise_and_resubmit" | "human_review";
    rubric_rows: Array<{
      label: string;
      score: number;
      maxScore: number;
      level?: string;
      evidence?: string;
      tone?: "success" | "warning" | "error";
      feedback?: string;
    }>;
    feedback: string;
    improvements: string;
    calculated_xp: number;
  };
}

interface ArtifactFeedbackTabProps {
  submittedAttempts: SubmittedArtifactAttempt[];
  activeFeedbackAttemptNo: number | null;
  isPanelExpanded: boolean;
  onSelectAttempt: (attemptNo: number) => void;
  latestEvaluation?: SubmittedArtifactAttempt["evaluation"];
  isEvaluationLoading?: boolean;
}

const formatSubmittedDate = (uploadedAt: string | null | undefined) => {
  if (!uploadedAt) return "Submitted";
  return `Submitted ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(uploadedAt))}`;
};

const DECISION_META = {
  pass: { label: "Passed", bg: "bg-success-50 text-success-700", border: "border-success-500" },
  human_review: {
    label: "Human Review Required",
    bg: "bg-warning-50 text-warning-700",
    border: "border-warning-500",
  },
  revise_and_resubmit: {
    label: "Revise & Resubmit",
    bg: "bg-warning-50 text-warning-700",
    border: "border-warning-500",
  },
} as const;

type DecisionMeta = (typeof DECISION_META)[keyof typeof DECISION_META];

export const ArtifactFeedbackTab: React.FC<ArtifactFeedbackTabProps> = ({
  submittedAttempts,
  activeFeedbackAttemptNo,
  isPanelExpanded,
  onSelectAttempt,
  latestEvaluation,
  isEvaluationLoading = false,
}) => {
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const selectedAttempt =
    submittedAttempts.find((attempt) => attempt.attemptNo === activeFeedbackAttemptNo) ??
    submittedAttempts[0] ??
    null;
  const submittedFileList = selectedAttempt?.files ?? [];

  const evaluationData = selectedAttempt?.evaluation ?? latestEvaluation;
  const selectedScore = evaluationData?.overall_score;
  const decisionMeta: DecisionMeta | null = evaluationData
    ? (DECISION_META[evaluationData.decision] ?? DECISION_META.human_review)
    : null;
  const rubricList = evaluationData?.rubric_rows ?? [];
  const feedbackText = evaluationData?.feedback ?? "";
  const improvementsText = evaluationData?.improvements ?? "";
  const statusLabel = isEvaluationLoading
    ? "Evaluation in progress…"
    : "Evaluation not available for this attempt.";

  const handleDownload = async (
    file: Pick<ModuleArtifactSubmittedFile, "id" | "fileName" | "downloadUrl">,
  ) => {
    setDownloadingFileId(file.id);
    try {
      const blob = await downloadArtifactFile(file.downloadUrl);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download file.");
    } finally {
      setDownloadingFileId(null);
    }
  };

  return (
    <div className="space-y-3" role="tabpanel">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Submitted artifact versions">
        {submittedAttempts.map((attempt) => {
          const isSelected = attempt.attemptNo === selectedAttempt?.attemptNo;
          const attemptScore =
            attempt.evaluation?.overall_score ??
            (attempt.attemptNo === selectedAttempt?.attemptNo ? selectedScore : null);
          return (
            <Button
              key={attempt.attemptNo}
              type="button"
              variant="outline"
              size="sm"
              role="tab"
              aria-selected={isSelected}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                isSelected
                  ? "border-success-500 bg-success-50 text-success-700"
                  : "border-line-default bg-surface-muted text-content-secondary hover:bg-surface-secondary"
              }`}
              onClick={() => onSelectAttempt(attempt.attemptNo)}
            >
              <span>{attempt.versionLabel}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${isSelected ? "bg-surface-primary text-success-700" : "bg-surface-primary text-content-muted"}`}
              >
                {attemptScore ?? "–"}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="rounded-xl border border-line-default bg-brand-50/30 p-3.5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 text-sm font-bold bg-surface-primary ${
              decisionMeta?.border ?? "border-line-default"
            }`}
          >
            {selectedScore ?? "–"}
          </div>
          <div className="min-w-0 space-y-1">
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${
                decisionMeta?.bg ?? "bg-surface-muted text-content-muted"
              }`}
            >
              {decisionMeta?.label ?? (isEvaluationLoading ? "Pending" : "Not Available")}
            </span>
            <p className="text-[11px] font-medium text-content-muted">
              {formatSubmittedDate(selectedAttempt?.submittedAt)}
            </p>
            <p className="text-[11px] font-medium text-content-muted">Evaluator: OpenRouter AI</p>
          </div>
        </div>
      </div>

      <div
        className={`flex items-center rounded-xl border border-line-default bg-surface-primary px-3 py-2 text-[11px] font-bold transition-all duration-300 ${isPanelExpanded ? "flex-nowrap gap-2" : "flex-wrap gap-x-3 gap-y-2"}`}
      >
        <span
          className={`inline-flex items-center gap-1.5 text-success-700 transition-all duration-300 ${isPanelExpanded ? "shrink-0" : "min-w-[104px] flex-1"}`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-50 transition-transform duration-300 hover:scale-105">
            <CheckIcon size={12} />
          </span>
          AI Review
        </span>
        {isPanelExpanded ? (
          <span className="h-px min-w-8 flex-1 bg-success-500 transition-all duration-300" />
        ) : null}
        <span
          className={`inline-flex items-center gap-1.5 text-brand-600 transition-all duration-300 ${isPanelExpanded ? "shrink-0" : "min-w-[104px] flex-1"}`}
        >
          <span className="h-5 w-5 rounded-full border border-line-default bg-brand-50" />
          Staff Review
        </span>
        {isPanelExpanded ? (
          <span className="h-px min-w-8 flex-1 bg-line-subtle transition-all duration-300" />
        ) : null}
        <span
          className={`inline-flex items-center gap-1.5 text-content-muted transition-all duration-300 ${isPanelExpanded ? "shrink-0" : "min-w-[104px] flex-1"}`}
        >
          <span className="h-5 w-5 rounded-full border border-line-default" />
          Industry Review
        </span>
      </div>

      {submittedFileList.length > 0 ? (
        <div className="rounded-xl border border-line-default bg-surface-primary p-3.5">
          <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-600">
            <ArtifactsIcon size={12} />
            File Upload
          </div>
          <div className="space-y-2">
            {submittedFileList.map((file) => (
              <Button
                key={file.id}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 w-full justify-start rounded-md px-2 py-2 text-[11px] font-medium text-brand-600"
                icon={<DocumentIcon size={13} />}
                disabled={downloadingFileId === file.id}
                onClick={() => void handleDownload(file)}
              >
                <span className="min-w-0 flex-1 truncate text-left">{file.fileName}</span>
                <span className="ml-2 inline-flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-content-muted">
                    {file.versionLabel}
                  </span>
                  {file.isLatest ? (
                    <span className="rounded bg-success-50 px-1.5 py-0.5 text-[10px] font-bold text-success-700">
                      Latest
                    </span>
                  ) : null}
                </span>
                <ChevronRightIcon size={12} className="ml-1 shrink-0" />
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-line-default bg-surface-primary p-3.5">
        <h5 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-content-primary">
          LTE Standard Rubric Breakdown (0–3 Scale)
        </h5>
        {rubricList.length > 0 ? (
          <div className="space-y-3">
            {rubricList.map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-content-primary">{row.label}</span>
                  <span className="font-bold text-brand-600">
                    {row.score}/3 {row.level ? `(${row.level})` : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line-subtle">
                  <div
                    className={`h-full rounded-full ${row.score >= 2 ? "bg-success-500" : "bg-warning-500"}`}
                    style={{ width: `${(row.score / (row.maxScore || 3)) * 100}%` }}
                  />
                </div>
                {row.evidence ? (
                  <p className="text-[11px] italic leading-tight text-content-muted">
                    Evidence: &ldquo;{row.evidence}&rdquo;
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-content-muted">{statusLabel}</p>
        )}
      </div>

      <div className="rounded-xl border border-brand-100 bg-brand-50 p-3.5">
        <h5 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-600">
          <MessageSquareIcon size={13} />
          AI & Evaluator Feedback
        </h5>
        {feedbackText ? (
          <>
            <p className="text-[12px] leading-relaxed text-content-primary">{feedbackText}</p>
            {improvementsText ? (
              <div className="mt-2.5 rounded-md bg-warning-50 p-2.5 text-[11px] font-medium text-warning-700">
                <span className="block font-bold mb-0.5">Clear Actionable Improvement Point:</span>
                {improvementsText}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[11px] text-content-muted">{statusLabel}</p>
        )}
      </div>
    </div>
  );
};
