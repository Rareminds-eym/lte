import type React from "react";
import type {
  EContentItem,
  LevelDetailsResponse,
  LteStage,
  ModuleDetailsResponse,
} from "@/entities/course";
import {
  BookOpenIcon,
  Button,
  ChevronRightIcon,
  ClockIcon,
  CodeXmlIcon,
  GraduationCapIcon,
  LayersIcon,
  LightbulbIcon,
  MessageSquareIcon,
  TargetIcon,
} from "@/shared/ui";

interface StageInfoPanelProps {
  level: LevelDetailsResponse;
  levelModule: ModuleDetailsResponse;
  activeStage: LteStage;
  activeArtifactType: "practice" | "final" | null;
  stageDescription: string;
  stageModuleContext?: string | null;
  stageCurriculumReference?: Record<string, unknown> | null;
  stageSummary: string;
  previewItems: EContentItem[];
  isScenarioExpanded: boolean;
  isScenarioOverflowing: boolean;
  setIsScenarioExpanded: (expanded: boolean) => void;
  formatStageLabel: (stage: LteStage) => string;
  renderArtifactPanel: () => React.ReactNode;
}

const getCurriculumText = (value: unknown) => {
  if (Array.isArray(value)) {
    const joined = value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .join(", ");
    return joined || null;
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
  isScenarioOverflowing,
  setIsScenarioExpanded,
  formatStageLabel,
  renderArtifactPanel,
}) => {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white p-3.5 text-content-body">
      {/* Level problem card */}
      <div className="rounded-xl border border-border-default bg-white px-3.5 py-3 shadow-2xs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-none border-0 bg-transparent p-0 text-left font-sans text-content-heading shadow-none hover:bg-transparent disabled:opacity-100 ${
            isScenarioOverflowing ? "cursor-pointer" : "cursor-default"
          }`}
          aria-expanded={isScenarioExpanded}
          disabled={!isScenarioOverflowing}
          onClick={() => setIsScenarioExpanded(!isScenarioExpanded)}
        >
          <span className="flex min-w-0 items-start gap-1.5 text-left text-[13px] font-bold leading-snug text-content-heading">
            <BookOpenIcon size={13} className="mt-0.5 shrink-0 text-brand-600" />
            <span className="min-w-0 flex-1">{level.levelProblemStatement.title}</span>
          </span>
          {isScenarioOverflowing ? (
            <ChevronRightIcon
              size={15}
              className={`shrink-0 text-content-muted transition-transform duration-200 ${
                isScenarioExpanded ? "rotate-90" : ""
              }`}
            />
          ) : null}
        </Button>
        <p
          className={`mt-2 text-[13px] leading-relaxed text-content-default ${
            isScenarioOverflowing && !isScenarioExpanded ? "line-clamp-3" : ""
          }`}
        >
          {level.levelProblemStatement.description}
        </p>
        {isScenarioOverflowing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-auto cursor-pointer rounded-none border-0 bg-transparent p-0 text-[11px] font-bold text-brand-600 shadow-none hover:bg-transparent hover:underline"
            onClick={() => setIsScenarioExpanded(!isScenarioExpanded)}
          >
            {isScenarioExpanded ? "Read less" : "Read more"}
          </Button>
        ) : null}
      </div>

      {/* Module Problem Statement Card */}
      {levelModule.moduleProblemStatement && (
        <div className="rounded-r-xl border border-brand-100 border-l-4 border-l-brand-600 bg-brand-50/70 p-3.5 shadow-2xs">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <TargetIcon size={13} className="shrink-0" />
            <span>Module Problem Statement</span>
          </div>
          <p className="text-[13px] leading-relaxed text-content-heading">
            {levelModule.moduleProblemStatement}
          </p>
        </div>
      )}

      {activeArtifactType ? renderArtifactPanel() : null}

      {/* Stage Info Card */}
      {!activeArtifactType ? (
        <div className="rounded-xl border border-border-default bg-white p-4 shadow-2xs">
          <h4 className="mb-1.5 text-base font-bold text-brand-600">
            {formatStageLabel(activeStage)} Stage
          </h4>
          <p className="mb-2.5 text-[13px] leading-relaxed text-content-default">
            {stageDescription}
          </p>

          <div className="text-xs text-content-secondary">
            <div className="flex items-center gap-1.5 border-t border-border-default py-1.5">
              <ClockIcon size={13} className="shrink-0 text-content-muted" />
              <span>Est. 20-30 minutes</span>
            </div>
            <div className="flex items-center gap-1.5 border-t border-border-default py-1.5">
              <TargetIcon size={13} className="shrink-0 text-content-muted" />
              <span>
                {previewItems.length} content item
                {previewItems.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 border-t border-border-default py-1.5">
              <GraduationCapIcon size={13} className="shrink-0 text-content-muted" />
              <span>
                {formatStageLabel(activeStage)} - {stageSummary}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Curriculum Reference Card */}
      {!activeArtifactType && stageCurriculumReference && (
        <div className="rounded-xl border border-success-200 bg-success-50/60 p-4 shadow-2xs">
          <div className="mb-3.5 flex items-center gap-2 border-b border-success-200 pb-2.5 text-success-700">
            <BookOpenIcon size={15} className="shrink-0" />
            <h5 className="text-[13px] font-bold">Curriculum Reference</h5>
          </div>

          <div className="space-y-3">
            {getCurriculumText(stageCurriculumReference["prerequisites"]) ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <GraduationCapIcon size={12} className="shrink-0" />
                  <span>Prerequisites</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                  {getCurriculumText(stageCurriculumReference["prerequisites"])}
                </p>
              </div>
            ) : null}

            {getCurriculumText(stageCurriculumReference["technical_concepts"]) ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <CodeXmlIcon size={12} className="shrink-0" />
                  <span>Technical Concepts</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                  {getCurriculumText(stageCurriculumReference["technical_concepts"])}
                </p>
              </div>
            ) : null}

            {getCurriculumText(stageCurriculumReference["credit_context"]) ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <LayersIcon size={12} className="shrink-0" />
                  <span>Credit Context</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                  {getCurriculumText(stageCurriculumReference["credit_context"])}
                </p>
              </div>
            ) : null}

            {getCurriculumText(stageCurriculumReference["when_to_use"]) ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <LightbulbIcon size={12} className="shrink-0" />
                  <span>When to Use</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                  {getCurriculumText(stageCurriculumReference["when_to_use"])}
                </p>
              </div>
            ) : null}

            {getCurriculumText(stageCurriculumReference["module_continuity"]) ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                  <ChevronRightIcon size={12} className="shrink-0" />
                  <span>Module Continuity</span>
                </div>
                <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                  {getCurriculumText(stageCurriculumReference["module_continuity"])}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Module Context Card */}
      {!activeArtifactType && stageModuleContext && (
        <div className="rounded-xl border border-border-default bg-surface-subtle p-3.5 shadow-2xs">
          <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
            Module Context
          </h5>
          <p className="mb-1.5 text-[13px] font-semibold leading-relaxed text-content-heading">
            {stageModuleContext}
          </p>
        </div>
      )}

      {/* Ask AI Card */}
      {!activeArtifactType ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50 p-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <MessageSquareIcon size={16} className="shrink-0 text-brand-600" />
            <div>
              <div className="text-[13px] font-bold text-content-heading">Ask AI Tutor</div>
              <div className="text-[11px] text-content-default">Get help with this stage</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-7 rounded-lg px-3 text-xs">
            Ask
          </Button>
        </div>
      ) : null}
    </div>
  );
};
