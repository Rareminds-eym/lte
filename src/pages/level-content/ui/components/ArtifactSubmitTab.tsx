import type React from "react";
import { useMemo, useState } from "react";
import type {
  ModuleArtifact,
  ModuleArtifactQuestion,
  ModuleArtifactSubmittedFile,
  ModuleArtifactTemplate,
} from "@/entities/course";
import { type SubmitArtifactResponse, useSubmitArtifact } from "@/features/submit-artifact";
import {
  Button,
  ChevronRightIcon,
  CloseIcon,
  DocumentIcon,
  DownloadIcon,
  IconButton,
  LightbulbIcon,
  LightningBoltIcon,
  toast,
} from "@/shared/ui";

interface ArtifactSubmitTabProps {
  activeArtifact: ModuleArtifact;
  artifactTemplates: ModuleArtifactTemplate[];
  activeQuestionId: string | null;
  setExpandedArtifactQuestionId: React.Dispatch<React.SetStateAction<string | null | undefined>>;
  submittedFiles: ModuleArtifactSubmittedFile[];
  onSubmitted: (response: SubmitArtifactResponse) => void;
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

const getAcceptValue = (question: ModuleArtifactQuestion) =>
  question.allowedFileTypes?.map((type) => `.${type.replace(/^\./, "")}`).join(",") ?? undefined;

const getUploadPrompt = (question: ModuleArtifactQuestion) => {
  if (!question.allowedFileTypes?.length) return "Upload file";
  return `Upload ${question.allowedFileTypes
    .map((type) => `.${type.replace(/^\./, "")}`)
    .join(", ")}`;
};

export const ArtifactSubmitTab: React.FC<ArtifactSubmitTabProps> = ({
  activeArtifact,
  artifactTemplates,
  activeQuestionId,
  setExpandedArtifactQuestionId,
  submittedFiles,
  onSubmitted,
}) => {
  const submitArtifact = useSubmitArtifact();
  const [textResponses, setTextResponses] = useState<Record<string, string>>({});
  const [urlResponses, setUrlResponses] = useState<Record<string, string>>({});
  const [fileResponses, setFileResponses] = useState<Record<string, File | null>>({});
  const isPractice = activeArtifact.artifactType === "practice";
  const hasQuestions = activeArtifact.questions.length > 0;

  const latestSubmittedFilesByQuestion = useMemo(() => {
    const filesByQuestion: Record<string, ModuleArtifactSubmittedFile> = {};
    for (const file of submittedFiles) {
      const current = filesByQuestion[file.questionId];
      if (!current || file.attemptNo > current.attemptNo) {
        filesByQuestion[file.questionId] = file;
      }
    }
    return filesByQuestion;
  }, [submittedFiles]);

  const requiredMissing = useMemo(
    () =>
      activeArtifact.questions.some((question) => {
        if (!question.responseRequired) return false;
        if (question.responseType === "text") return !textResponses[question.id]?.trim();
        if (question.responseType === "url") return !urlResponses[question.id]?.trim();
        if (question.responseType === "file") {
          return !fileResponses[question.id] && !latestSubmittedFilesByQuestion[question.id];
        }
        return false;
      }),
    [
      activeArtifact.questions,
      fileResponses,
      latestSubmittedFilesByQuestion,
      textResponses,
      urlResponses,
    ],
  );

  const handleSubmit = () => {
    submitArtifact.mutate(
      {
        artifactId: activeArtifact.id,
        answers: activeArtifact.questions.map((question) => ({
          questionId: question.id,
          textResponse: textResponses[question.id]?.trim() || undefined,
          urlResponse: urlResponses[question.id]?.trim() || undefined,
          file: fileResponses[question.id] ?? undefined,
        })),
      },
      {
        onSuccess: (response) => {
          if (response.duplicate) {
            toast("Already submitted");
            return;
          }
          setFileResponses({});
          onSubmitted(response);
          toast.success(isPractice ? "Practice work saved." : "Artifact submitted.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Unable to submit artifact.");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3" role="tabpanel">
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
        const selectedFile = fileResponses[question.id];
        const fileInputId = `artifact-file-${question.id}`;

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
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Q{question.questionOrder}
                </span>
                <span className="min-w-0 truncate text-[13px] font-bold leading-snug text-content-primary">
                  {question.title}
                </span>
              </span>
              <span className="ml-2 flex shrink-0 items-center gap-2">
                {question.responseRequired ? (
                  <span className="rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold text-warning-700">
                    Required
                  </span>
                ) : null}
                <ChevronRightIcon
                  size={14}
                  className={`shrink-0 text-content-muted transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </span>
            </Button>

            {isExpanded ? (
              <div className="space-y-3 bg-surface-primary p-3.5">
                <p className="break-words text-[13px] leading-relaxed text-content-primary">
                  {question.description}
                </p>

                {requiredFields || instructions ? (
                  <div className="flex min-w-0 items-start gap-2 rounded-md bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-content-secondary">
                    <LightbulbIcon size={13} className="mt-0.5 shrink-0 text-brand-600" />
                    <span className="min-w-0 break-words">{requiredFields ?? instructions}</span>
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
                          <span className="min-w-0 truncate">{template.fileName}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {question.responseType === "text" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold text-content-muted">
                      Response
                    </span>
                    <textarea
                      className="min-h-24 w-full resize-y rounded-lg border border-line-default bg-surface-primary px-3 py-2 text-[13px] leading-relaxed text-content-primary outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      placeholder="Write your response here..."
                      value={textResponses[question.id] ?? ""}
                      onChange={(event) =>
                        setTextResponses((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}

                {question.responseType === "url" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold text-content-muted">
                      URL
                    </span>
                    <input
                      type="url"
                      className="h-10 w-full rounded-lg border border-line-default bg-surface-primary px-3 text-[13px] text-content-primary outline-none transition placeholder:text-content-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      placeholder="https://example.com"
                      value={urlResponses[question.id] ?? ""}
                      onChange={(event) =>
                        setUrlResponses((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}

                {question.responseType === "file" ? (
                  <div className="block">
                    <input
                      id={fileInputId}
                      type="file"
                      accept={getAcceptValue(question)}
                      className="hidden"
                      onChange={(event) =>
                        setFileResponses((current) => ({
                          ...current,
                          [question.id]: event.target.files?.[0] ?? null,
                        }))
                      }
                    />
                    <div className="block rounded-2xl border border-line-subtle bg-surface-muted p-4">
                      {selectedFile ? (
                        <div className="flex min-h-32 items-center justify-center rounded-xl border-2 border-dashed border-line-default bg-surface-primary px-4 py-7">
                          <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-line-default bg-surface-primary p-3 shadow-xs">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                                <DocumentIcon size={20} />
                              </span>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span
                                  className="truncate text-[13px] font-semibold text-content-primary"
                                  title={selectedFile.name}
                                >
                                  {selectedFile.name}
                                </span>
                                <span className="text-[11px] font-medium text-content-muted">
                                  {(selectedFile.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>
                            <IconButton
                              type="button"
                              aria-label="Remove selected file"
                              icon={<CloseIcon size={16} />}
                              size="sm"
                              variant="outline"
                              className="shrink-0 rounded-lg text-content-muted hover:bg-surface-secondary hover:text-content-secondary"
                              onClick={() => {
                                setFileResponses((current) => ({
                                  ...current,
                                  [question.id]: null,
                                }));
                                const input = document.getElementById(fileInputId);
                                if (input instanceof HTMLInputElement) input.value = "";
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <label
                          htmlFor={fileInputId}
                          className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-default bg-surface-primary px-4 py-7 text-center transition hover:border-line-strong"
                        >
                          <DownloadIcon size={26} className="text-content-muted stroke-[1.25]" />
                          <span className="mt-2.5 max-w-full truncate text-[14px] font-medium text-content-primary">
                            {getUploadPrompt(question)}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="flex items-center justify-end gap-2 border-t border-line-subtle pt-3">
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-md px-3 text-xs"
          disabled={!hasQuestions || requiredMissing || submitArtifact.isPending}
          onClick={handleSubmit}
        >
          {submitArtifact.isPending
            ? "Submitting..."
            : isPractice
              ? "Save Practice Work"
              : "Submit Artifact"}
        </Button>
      </div>
    </div>
  );
};
