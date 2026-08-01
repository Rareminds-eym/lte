import type React from "react";
import type {
  ModuleArtifact,
  ModuleArtifactQuestion,
  ModuleArtifactTemplate,
} from "@/entities/course";
import {
  Button,
  ChevronRightIcon,
  DownloadIcon,
  LabFlaskIcon,
  LightbulbIcon,
  LightningBoltIcon,
} from "@/shared/ui";

interface ArtifactPanelProps {
  activeArtifact: ModuleArtifact | null | undefined;
  activeArtifactType: "practice" | "final" | null;
  rightPanelTitle: string;
  expandedArtifactQuestionId: string | null | undefined;
  setExpandedArtifactQuestionId: React.Dispatch<React.SetStateAction<string | null | undefined>>;
}

const getInstructionValue = (instructions: ModuleArtifactQuestion["instructions"], key: string) => {
  if (typeof instructions === "string") return key === "instructions" ? instructions : null;
  const value = instructions[key];
  return typeof value === "string" && value.trim().length ? value : null;
};

const getQuestionTemplates = (
  question: ModuleArtifactQuestion,
  templates: ModuleArtifactTemplate[],
) =>
  templates.filter(
    (template) => template.questionId === question.id || template.questionId === null,
  );

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  activeArtifact,
  activeArtifactType,
  rightPanelTitle,
  expandedArtifactQuestionId,
  setExpandedArtifactQuestionId,
}) => {
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
  const ArtifactIcon = isPractice ? LabFlaskIcon : LightningBoltIcon;
  const artifactTemplates = activeArtifact.templates;
  const firstQuestionId = activeArtifact.questions[0]?.id ?? null;
  const activeQuestionId =
    expandedArtifactQuestionId === undefined
      ? firstQuestionId
      : expandedArtifactQuestionId &&
          activeArtifact.questions.some((q) => q.id === expandedArtifactQuestionId)
        ? expandedArtifactQuestionId
        : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isPractice ? "bg-warning-50 text-warning-700" : "bg-brand-50 text-brand-600"
            }`}
          >
            <ArtifactIcon size={12} />
            {isPractice ? "Practice" : "Final Artifact"}
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-medium text-content-muted">
            <span className="rounded-md bg-surface-muted px-2 py-0.5">
              Pass: {activeArtifact.passingScore ?? "-"} / {activeArtifact.totalScore}
            </span>
            <span className="rounded-md bg-surface-muted px-2 py-0.5">
              {activeArtifact.questions.length} question
              {activeArtifact.questions.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="rounded-md bg-surface-muted px-2 py-1 text-[11px] font-bold text-content-secondary">
          {activeArtifact.totalScore} pts
        </div>
      </div>

      {isPractice ? (
        <div className="flex items-start gap-2 rounded-lg border-l-4 border-l-brand-600 bg-brand-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-brand-700">
          <LightbulbIcon size={14} className="mt-0.5 shrink-0" />
          <span>
            This is a practice artifact. Complete it to understand the concepts - no evaluation or
            scoring.
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border-l-4 border-l-brand-600 bg-brand-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-brand-700">
          <LightningBoltIcon size={14} className="mt-0.5 shrink-0" />
          <span>Build and submit your final evaluated artifact.</span>
        </div>
      )}

      {activeArtifact.questions.map((question) => {
        const requiredFields = getInstructionValue(question.instructions, "required_fields");
        const instructions = getInstructionValue(question.instructions, "instructions");
        const questionTemplates = getQuestionTemplates(question, artifactTemplates);
        const isExpanded = question.id === activeQuestionId;

        return (
          <div
            key={question.id}
            className="overflow-hidden rounded-xl border border-line-default bg-surface-primary shadow-2xs"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex h-auto w-full justify-between rounded-none border-0 border-b border-line-subtle bg-surface-muted px-3.5 py-3 text-left font-sans hover:bg-surface-secondary"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedArtifactQuestionId((current) =>
                  current === question.id ? null : question.id,
                )
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Q{question.questionOrder}
                </span>
                <span className="truncate text-[13px] font-bold leading-snug text-content-primary">
                  {question.title}
                </span>
                {!isPractice ? (
                  <span className="rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold text-warning-700">
                    Required
                  </span>
                ) : null}
              </span>
              <ChevronRightIcon
                size={14}
                className={`shrink-0 text-content-muted transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
            </Button>

            {isExpanded ? (
              <div className="space-y-3 bg-surface-primary p-3.5">
                <p className="text-[13px] leading-relaxed text-content-primary">
                  {question.description}
                </p>

                {requiredFields || instructions ? (
                  <div className="flex items-start gap-2 rounded-md bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-content-secondary">
                    <LightbulbIcon size={13} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>{requiredFields ?? instructions}</span>
                  </div>
                ) : null}

                {questionTemplates.length ? (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-content-muted">Templates:</div>
                    <div className="flex flex-wrap gap-2">
                      {questionTemplates.map((template) => (
                        <Button
                          key={template.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 max-w-full justify-start rounded-md px-2 text-[11px]"
                          icon={<DownloadIcon size={12} />}
                          onClick={() =>
                            window.open(template.fileUrl, "_blank", "noopener,noreferrer")
                          }
                        >
                          <span className="truncate">{template.fileName}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="relative">
                  <textarea
                    className="min-h-24 w-full resize-y rounded-lg border border-line-default bg-surface-primary px-3 py-2 text-[13px] leading-relaxed text-content-primary outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    placeholder="Write your response here..."
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {!isPractice ? (
                      <span className="text-[11px] font-medium text-content-muted">
                        {activeArtifact.passingScore ?? "-"} / {activeArtifact.totalScore} pass
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-md px-3 text-xs"
                      disabled
                    >
                      {isPractice ? "Save Practice Work" : "Submit Artifact"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
