import type React from "react";
import type {
  EContentItem,
  LevelDetailsResponse,
  LteStage,
  ModuleDetailsResponse,
} from "@/entities/course";
import {
  ArrowRightIcon,
  BookIcon,
  BrainIcon,
  Button,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClockIcon,
  CodeXmlIcon,
  CopyIcon,
  DocumentIcon,
  GraduationCapIcon,
  LayersIcon,
  LightbulbIcon,
  LightningBoltIcon,
  MessageSquareIcon,
  TargetIcon,
  TextField,
  toast,
} from "@/shared/ui";

interface StageInfoPanelProps {
  level: LevelDetailsResponse;
  levelModule: ModuleDetailsResponse;
  activeStage: LteStage;
  activeArtifactType: "practice" | "final" | null;
  stageDescription: string;
  stageModuleContext?: string | null;
  stageCurriculumReference?: Record<string, unknown> | string[] | null;
  stageSummary: string;
  previewItems: EContentItem[];
  isScenarioExpanded: boolean;
  setIsScenarioExpanded: (expanded: boolean) => void;
  formatStageLabel: (stage: LteStage) => string;
  renderArtifactPanel: () => React.ReactNode;
}

const getCurriculumText = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const joined = value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .join(", ");
    return joined || null;
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

const getCurriculumRecord = (
  value: Record<string, unknown> | string[] | null | undefined,
): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    return value.reduce<Record<string, string>>((record, entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex <= 0) return record;

      const key = entry.slice(0, separatorIndex).trim();
      const text = entry.slice(separatorIndex + 1).trim();
      if (key && text) {
        record[key] = text;
      }
      return record;
    }, {});
  }

  if (value && typeof value === "object") {
    return value;
  }

  return null;
};

export const StageInfoPanel: React.FC<StageInfoPanelProps> = ({
  level,
  levelModule,
  activeStage,
  activeArtifactType,
  stageDescription,
  stageModuleContext,
  stageCurriculumReference,
  stageSummary,
  previewItems,
  isScenarioExpanded,
  setIsScenarioExpanded,
  formatStageLabel,
  renderArtifactPanel,
}) => {
  const curriculumRecord = getCurriculumRecord(stageCurriculumReference);
  const curriculumReference = curriculumRecord
    ? {
        prerequisites: getCurriculumText(curriculumRecord["prerequisites"]),
        technicalConcepts: getCurriculumText(curriculumRecord["technical_concepts"]),
        creditContext: getCurriculumText(curriculumRecord["credit_context"]),
        whenToUse: getCurriculumText(curriculumRecord["when_to_use"]),
        moduleContinuity: getCurriculumText(curriculumRecord["module_continuity"]),
      }
    : null;
  const shouldShowCurriculumReference =
    !activeArtifactType &&
    curriculumReference !== null &&
    Object.values(curriculumReference).some(Boolean);

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-primary px-3.5 pb-3.5 text-content-body">
      {/* Level problem card */}
      <div className="sticky top-0 z-20 -mx-3.5 bg-surface-primary px-3.5 pb-4 pt-3.5 shadow-[0_6px_12px_-10px_rgba(15,23,42,0.14)]">
        <div className="rounded-xl border border-brand-700 bg-brand-800 p-4 text-white shadow-lg">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <BookIcon size={16} className="h-4 w-4 text-white" />
            </span>
            <h3 className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug text-white">
              Main Problem Statement
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Copy main problem statement"
              title="Copy main problem statement"
              className="h-9 w-9 shrink-0 rounded-lg border-0 bg-transparent p-0 !text-brand-200 shadow-none hover:bg-white/10 hover:!text-white"
              onClick={() => {
                void navigator.clipboard
                  .writeText(level.levelProblemStatement.description)
                  .catch(() => {
                    toast.error("Unable to copy problem statement.");
                  });
              }}
            >
              <CopyIcon size={20} className="h-5 w-5" />
            </Button>
          </div>

          <p
            className={`mt-3 pr-1 text-[13px] leading-5 text-white/90 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              isScenarioExpanded
                ? "max-h-44 overflow-y-auto overscroll-contain"
                : "max-h-15 overflow-y-auto overscroll-contain"
            }`}
          >
            {level.levelProblemStatement.description}
          </p>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 flex h-auto w-full cursor-pointer items-center justify-start gap-2 rounded-none border-0 border-t border-dashed border-white/25 bg-transparent px-0 pt-2.5 text-[13px] font-semibold !text-brand-200 shadow-none hover:bg-transparent hover:!text-white"
            aria-expanded={isScenarioExpanded}
            onClick={() => setIsScenarioExpanded(!isScenarioExpanded)}
          >
            <span>{isScenarioExpanded ? "Show Less" : "Show Full Problem Statement"}</span>
            <ChevronRightIcon
              size={14}
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                isScenarioExpanded ? "-rotate-90" : "rotate-90"
              }`}
            />
          </Button>
        </div>
      </div>

      {/* Module Context Card */}
      {!activeArtifactType && stageModuleContext && (
        <details
          open
          className="group rounded-xl border border-warning-100 bg-warning-50 p-4 shadow-2xs"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 text-warning-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-100">
              <DocumentIcon size={18} className="text-warning-600" />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug">
              Module Context
            </span>
            <ChevronRightIcon
              size={16}
              className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-90"
            />
          </summary>

          <div className="pt-4">
            <p className="text-[13px] leading-relaxed text-content-heading">{stageModuleContext}</p>
          </div>
        </details>
      )}

      {/* Module Problem Statement Card */}
      {levelModule.moduleProblemStatement && (
        <details open className="group rounded-xl border border-success-100 bg-success-50 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-success-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-100">
              <TargetIcon size={18} className="text-success-800" />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug">
              Module Problem Statement
            </span>
            <ChevronRightIcon
              size={16}
              className="h-4 w-4 shrink-0 text-success-700 transition-transform duration-200 group-open:rotate-90"
            />
          </summary>
          <p className="pt-4 text-[13px] leading-relaxed text-content-heading">
            {levelModule.moduleProblemStatement}
          </p>
        </details>
      )}

      {activeArtifactType ? renderArtifactPanel() : null}

      {/* Stage Info Card */}
      {!activeArtifactType ? (
        <details
          open
          className="group rounded-xl border border-line-default bg-surface-subtle p-4 shadow-2xs"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
              <LightningBoltIcon size={18} className="text-brand-800" />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug">
              {formatStageLabel(activeStage)} Statement
            </span>
            <ChevronRightIcon
              size={16}
              className="h-4 w-4 shrink-0 text-content-secondary transition-transform duration-200 group-open:rotate-90"
            />
          </summary>

          <div className="pt-4">
            <p className="pb-4 text-[13px] leading-relaxed text-content-default">
              {stageDescription}
            </p>

            <div className="text-[12px] text-content-secondary">
              <div className="flex items-center gap-2.5 border-t border-line-subtle py-3">
                <ClockIcon size={16} className="h-4 w-4 shrink-0 text-content-muted" />
                <span>Est. 20-30 minutes</span>
              </div>
              <div className="flex items-center gap-2.5 border-t border-line-subtle py-3">
                <TargetIcon size={16} className="h-4 w-4 shrink-0 text-content-muted" />
                <span>
                  {previewItems.length} content item
                  {previewItems.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 border-t border-line-subtle pt-3">
                <GraduationCapIcon size={16} className="h-4 w-4 shrink-0 text-content-muted" />
                <span>
                  {formatStageLabel(activeStage)} - {stageSummary}
                </span>
              </div>
            </div>
          </div>
        </details>
      ) : null}

      {/* Curriculum Reference Card */}
      {shouldShowCurriculumReference ? (
        <details
          open
          className="group rounded-xl border border-success-200 bg-success-50/70 p-4 shadow-2xs"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 border-b border-success-200 pb-3 text-success-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-100">
              <BookIcon size={18} className="text-success-700" />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug">
              Curriculum Statement
            </span>
            <ChevronRightIcon
              size={16}
              className="h-4 w-4 shrink-0 text-content-secondary transition-transform duration-200 group-open:rotate-90"
            />
          </summary>

          <div className="space-y-3 pt-4">
            {curriculumReference.prerequisites ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <GraduationCapIcon size={14} className="shrink-0" />
                  <span>Prerequisites</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-content-default">
                  {curriculumReference.prerequisites}
                </p>
              </div>
            ) : null}

            {curriculumReference.technicalConcepts ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <CodeXmlIcon size={14} className="shrink-0" />
                  <span>Technical Concepts</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-content-default">
                  {curriculumReference.technicalConcepts}
                </p>
              </div>
            ) : null}

            {curriculumReference.creditContext ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <LayersIcon size={14} className="shrink-0" />
                  <span>Credit Context</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-content-default">
                  {curriculumReference.creditContext}
                </p>
              </div>
            ) : null}

            {curriculumReference.whenToUse ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <LightbulbIcon size={14} className="shrink-0" />
                  <span>When to Use</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-content-default">
                  {curriculumReference.whenToUse}
                </p>
              </div>
            ) : null}

            {curriculumReference.moduleContinuity ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <ChevronRightIcon size={14} className="shrink-0" />
                  <span>Module Continuity</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-content-default">
                  {curriculumReference.moduleContinuity}
                </p>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {/* Ask AI Card */}
      {!activeArtifactType ? (
        <details
          open
          className="group rounded-xl border border-brand-100 bg-brand-50 p-4 shadow-2xs"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 border-b border-brand-200 pb-3 text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100">
              <MessageSquareIcon size={18} />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-bold uppercase leading-snug">
              Ask AI Tutor
            </span>
            <span className="rounded-full border border-line-default bg-surface-primary px-3 py-1 text-[12px] font-semibold text-content-heading shadow-2xs">
              Ask
            </span>
            <ChevronRightIcon
              size={16}
              className="h-4 w-4 shrink-0 text-content-secondary transition-transform duration-200 group-open:rotate-90"
            />
          </summary>

          <div className="space-y-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-lg border-brand-200 bg-surface-primary px-3 py-2 text-left text-[13px] font-medium text-brand-600 shadow-none hover:bg-brand-50"
            >
              <LightbulbIcon size={16} className="h-4 w-4 shrink-0" />
              <span>What are the authority boundaries?</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-lg border-brand-200 bg-surface-primary px-3 py-2 text-left text-[13px] font-medium text-brand-600 shadow-none hover:bg-brand-50"
            >
              <CodeXmlIcon size={16} className="h-4 w-4 shrink-0" />
              <span>Explain {formatStageLabel(activeStage)} concepts</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto w-full justify-start gap-2 rounded-lg border-brand-200 bg-surface-primary px-3 py-2 text-left text-[13px] font-medium text-brand-600 shadow-none hover:bg-brand-50"
            >
              <ClipboardCheckIcon size={16} className="h-4 w-4 shrink-0" />
              <span>Help me complete {levelModule.title}</span>
            </Button>

            <div className="flex items-start gap-2.5 rounded-lg border border-brand-200 bg-surface-primary p-3 text-[13px] leading-relaxed text-content-default">
              <BrainIcon size={16} className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <p>
                Hello! I am your AI Project Control Tutor. Ask me any question about your current
                case study or select a prompt above.
              </p>
            </div>

            <div className="relative">
              <TextField
                aria-label="Ask your AI Tutor a question"
                placeholder="Ask your AI Tutor a question..."
                className="h-10 rounded-full border-brand-200 bg-surface-primary pr-12 text-[13px]"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                aria-label="Send question"
                title="Send question"
                className="absolute right-1 top-1 h-8 w-8 aspect-square !rounded-full p-0"
              >
                <ArrowRightIcon size={16} className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
};
