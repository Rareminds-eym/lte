import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  type EContentItem,
  type ModuleArtifact,
  type ModuleArtifactQuestion,
  type ModuleArtifactTemplate,
  type ModuleDetailsResponse,
  type ModuleStageContent,
  ResourceContentViewer,
  useLevelContentData,
} from "@/entities/course";
import {
  BookOpenIcon,
  Button,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CodeXmlIcon,
  DocumentIcon,
  DownloadIcon,
  ExpandIcon,
  GraduationCapIcon,
  IconButton,
  type IconProps,
  LabFlaskIcon,
  LayersIcon,
  LightbulbIcon,
  LightningBoltIcon,
  MessageSquareIcon,
  PlayIcon,
  TargetIcon,
} from "@/shared/ui";
import {
  LevelHeader,
  type LteStage,
  type ModuleItem,
  ModulesDrawer,
  StageStepperBar,
} from "@/widgets";

const STAGES: LteStage[] = ["engage", "explore", "explain", "express", "empower", "evolve"];
const LEVEL_CONTENT_UNAVAILABLE_MESSAGE =
  "This course content is not available right now. Please go back to your courses and try again.";

const formatStageLabel = (stage: LteStage) => stage.charAt(0).toUpperCase() + stage.slice(1);

const formatDuration = (seconds: number | null) => {
  if (!seconds) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
};

const formatContentType = (contentType: EContentItem["contentType"]) =>
  contentType.charAt(0).toUpperCase() + contentType.slice(1);

const getContentIcon = (contentType: EContentItem["contentType"]) => {
  if (contentType === "video" || contentType === "audio") return PlayIcon;
  return DocumentIcon;
};

const getDownloadFileName = (item: EContentItem) => {
  const urlFileName = item.url.split("/").pop()?.split("?")[0];
  return decodeURIComponent(urlFileName || item.title).replace(/[<>:"/\\|?*]+/g, "-");
};

const getStageSummary = (module: ModuleDetailsResponse, stageContent: ModuleStageContent) => {
  if (stageContent.items.length) {
    return `${stageContent.items.length} published resource${stageContent.items.length === 1 ? "" : "s"} available for this stage.`;
  }

  if (stageContent.artifacts.length) {
    return `${stageContent.artifacts.length} artifact${stageContent.artifacts.length === 1 ? "" : "s"} available for this stage.`;
  }

  return module.moduleProblemStatement ?? "No published content has been added for this stage yet.";
};

const getRecordSummary = (value: Record<string, unknown>) => {
  const strings = Object.values(value)
    .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  return strings.slice(0, 2);
};

const getPrimaryArtifact = (artifacts: ModuleArtifact[]) =>
  artifacts.find((artifact) => artifact.artifactType === "final") ?? artifacts[0] ?? null;

const getArtifactPanelTitle = (artifact: ModuleArtifact | null) => {
  if (artifact?.artifactType === "practice") return "Practice Artifact";
  if (artifact?.artifactType === "final") return "Final Artifact";
  return "Stage Info";
};

const getArtifactStepperMeta = (artifact: ModuleArtifact | null) => {
  if (artifact?.artifactType === "practice") {
    return { subtitle: "Practice Artifact", icon: LabFlaskIcon };
  }

  if (artifact?.artifactType === "final") {
    return { subtitle: "Final Artifact", icon: LightningBoltIcon };
  }

  return null;
};

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

export const LevelContentPage: React.FC = () => {
  const navigate = useNavigate();
  const { levelId, moduleNo } = useParams<{ levelId: string; moduleNo: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isModulesOpen, setIsModulesOpen] = useState(true);
  const [isStageInfoOpen, setIsStageInfoOpen] = useState(true);
  const [isStageInfoExpanded, setIsStageInfoExpanded] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<"modules" | "stageInfo" | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isScenarioExpanded, setIsScenarioExpanded] = useState(false);
  const [isScenarioOverflowing, setIsScenarioOverflowing] = useState(false);
  const [expandedArtifactQuestionId, setExpandedArtifactQuestionId] = useState<
    string | null | undefined
  >();
  const contentViewerRef = useRef<HTMLDivElement>(null);
  const scenarioTextRef = useRef<HTMLParagraphElement>(null);

  const moduleNumber = Number(moduleNo);
  const hasValidRouteParams = Boolean(levelId) && Number.isInteger(moduleNumber);
  const { data, isLoading, isError } = useLevelContentData(
    levelId,
    hasValidRouteParams ? moduleNumber : undefined,
  );

  const rawStage = searchParams.get("stage")?.toLowerCase();
  const activeStage: LteStage = STAGES.includes(rawStage as LteStage)
    ? (rawStage as LteStage)
    : "engage";

  useEffect(() => {
    const measureScenarioText = () => {
      const element = scenarioTextRef.current;
      if (!element) return;

      const computedStyle = window.getComputedStyle(element);
      const lineHeight = Number.parseFloat(computedStyle.lineHeight);
      const collapsedHeight = Number.isFinite(lineHeight) ? lineHeight * 3 : element.clientHeight;
      const nextIsOverflowing = element.scrollHeight > collapsedHeight + 1;

      setIsScenarioOverflowing(nextIsOverflowing);
      if (!nextIsOverflowing) {
        setIsScenarioExpanded(false);
      }
    };

    measureScenarioText();
    window.addEventListener("resize", measureScenarioText);

    return () => {
      window.removeEventListener("resize", measureScenarioText);
    };
  }, [data?.level.levelProblemStatement.description, isStageInfoExpanded, isStageInfoOpen]);

  const handleBackToOverview = () => {
    navigate("/my-courses");
  };

  const handleStageSelect = (stage: LteStage) => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      updated.set("stage", stage);
      return updated;
    });
  };

  const handleModuleSelect = (targetModuleNo: number) => {
    if (!levelId) return;
    navigate(`/courses/${levelId}/modules/${targetModuleNo}?stage=engage`);
    setMobilePanelOpen(null);
  };

  const handleToggleModules = () => {
    setIsModulesOpen((prev) => !prev);
    setMobilePanelOpen((prev) => (prev === "modules" ? null : "modules"));
  };

  const handleToggleStageInfo = () => {
    setIsStageInfoOpen((prev) => !prev);
    setMobilePanelOpen((prev) => (prev === "stageInfo" ? null : "stageInfo"));
  };

  const handleDownloadContent = async (item: EContentItem) => {
    setIsDownloading(true);

    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error("Download failed");

      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = getDownloadFileName(item);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExpandContent = async (item: EContentItem) => {
    try {
      if (contentViewerRef.current?.requestFullscreen) {
        await contentViewerRef.current.requestFullscreen();
        return;
      }
    } catch {
      // Fall back to opening the resource when fullscreen is blocked by the browser.
    }

    window.open(item.url, "_blank", "noopener,noreferrer");
  };

  const handleExpandStageInfo = () => {
    setIsStageInfoExpanded((prev) => !prev);
  };

  const renderUnavailableState = (message: string) => (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-line-subtle text-center max-w-md w-full">
      <h3 className="text-base md:text-lg font-bold text-content-primary mb-2">
        Course Content Not Available
      </h3>
      <p className="text-xs text-content-secondary mb-4">{message}</p>
      <Button type="button" onClick={handleBackToOverview} size="sm">
        Back to Courses
      </Button>
    </div>
  );

  if (!hasValidRouteParams) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-secondary p-4">
        {renderUnavailableState(LEVEL_CONTENT_UNAVAILABLE_MESSAGE)}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-secondary p-4">
        <div className="w-full max-w-4xl space-y-4">
          <div className="h-8 w-64 bg-surface-muted rounded-lg animate-pulse" />
          <div className="h-40 w-full bg-white border border-line-subtle rounded-2xl animate-pulse" />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-28 bg-white border border-line-subtle rounded-2xl animate-pulse" />
            <div className="h-28 bg-white border border-line-subtle rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-secondary p-4">
        {renderUnavailableState(LEVEL_CONTENT_UNAVAILABLE_MESSAGE)}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-secondary p-4">
        {renderUnavailableState(LEVEL_CONTENT_UNAVAILABLE_MESSAGE)}
      </div>
    );
  }

  const level = data.level;
  const levelModule = data.module;
  const activeStageContent = levelModule.stages.find((stage) => stage.stageName === activeStage);

  if (!activeStageContent) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-secondary p-4">
        {renderUnavailableState(LEVEL_CONTENT_UNAVAILABLE_MESSAGE)}
      </div>
    );
  }

  const completedStages = levelModule.stages
    .filter((stage) => stage.stageOrder < activeStageContent.stageOrder)
    .map((stage) => stage.stageName);
  const previewItems = activeStageContent.items;
  const stageSummary = getStageSummary(levelModule, activeStageContent);
  const stageDescription = activeStageContent.stageDescription;
  const activeStageIndex = STAGES.indexOf(activeStage);
  const previousStage: LteStage | null =
    activeStageIndex > 0 ? (STAGES[activeStageIndex - 1] ?? null) : null;
  const nextStage: LteStage | null =
    activeStageIndex >= 0 && activeStageIndex < STAGES.length - 1
      ? (STAGES[activeStageIndex + 1] ?? null)
      : null;
  const selectedContent =
    previewItems.find((item) => item.id === selectedContentId) ?? previewItems[0] ?? null;
  const activeArtifact = getPrimaryArtifact(activeStageContent.artifacts);
  const activeArtifactType = activeArtifact?.artifactType ?? null;
  const rightPanelTitle = getArtifactPanelTitle(activeArtifact);
  const stageStepperOverrides = levelModule.stages.reduce<
    Partial<
      Record<
        LteStage,
        {
          subtitle: string;
          icon: React.FC<IconProps>;
        }
      >
    >
  >((overrides, stage) => {
    const artifactMeta = getArtifactStepperMeta(getPrimaryArtifact(stage.artifacts));
    if (artifactMeta) {
      overrides[stage.stageName] = artifactMeta;
    }
    return overrides;
  }, {});
  const moduleDrawerItems: ModuleItem[] = level.modules.map((m) => {
    const isCurrentModule = m.moduleNo === moduleNumber;
    const totalStages = Math.max(levelModule.stages.length, 1);
    const activeStageProgress = Math.round((activeStageContent.stageOrder / totalStages) * 100);

    return {
      id: m.id,
      moduleNo: m.moduleNo,
      title: m.title,
      progressPercentage: m.progressPercentage ?? (isCurrentModule ? activeStageProgress : 0),
      stageProgressDots: isCurrentModule
        ? levelModule.stages.map((stage) => {
            if (stage.stageOrder < activeStageContent.stageOrder) return "green";
            if (stage.stageOrder === activeStageContent.stageOrder) return "blue";
            return "gray";
          })
        : undefined,
    };
  });

  const handleStageNavigation = (stage: LteStage | null) => {
    if (!stage) return;
    setSelectedContentId(null);
    handleStageSelect(stage);
  };

  const renderStageNavigationBar = () => (
    <div className="sticky bottom-0 z-20 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-line-default bg-surface-primary px-4 shadow-[0_-4px_12px_rgba(15,23,42,0.05)]">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start text-content-muted"
        disabled={!previousStage}
        icon={<ChevronLeftIcon size={16} />}
        onClick={() => handleStageNavigation(previousStage)}
      >
        Previous
      </Button>

      <div className="flex items-center gap-1.5">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            aria-label={`Go to ${formatStageLabel(stage)} stage`}
            className={`h-2 rounded-full transition-all ${
              stage === activeStage ? "w-6 bg-brand-600" : "w-2 bg-success-500"
            }`}
            onClick={() => handleStageNavigation(stage)}
          />
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        className="justify-self-end"
        onClick={() => handleStageNavigation(nextStage)}
      >
        <span className="inline-flex items-center gap-1.5">
          {nextStage ? "Mark Done & Next" : "Mark as Completed"}
          {nextStage ? <ChevronRightIcon size={16} /> : <CheckIcon size={16} />}
        </span>
      </Button>
    </div>
  );

  const renderArtifactPanel = () => {
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
  const renderStageInfoPanel = () => (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white p-3.5 text-slate-700">
      {/* Level problem card */}
      <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-2xs">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-2 border-0 bg-transparent p-0 text-left font-sans text-slate-800"
          aria-expanded={isScenarioExpanded}
          disabled={!isScenarioOverflowing}
          onClick={() => setIsScenarioExpanded(!isScenarioExpanded)}
        >
          <span className="flex items-start gap-1.5 text-[13px] font-bold leading-snug text-slate-800">
            <BookOpenIcon size={13} className="mt-0.5 shrink-0 text-brand-600" />
            {level.levelProblemStatement.title}
          </span>
          {isScenarioOverflowing ? (
            <ChevronRightIcon
              size={15}
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                isScenarioExpanded ? "rotate-90" : ""
              }`}
            />
          ) : null}
        </button>
        <p
          ref={scenarioTextRef}
          className={`mt-2 text-[13px] leading-relaxed text-slate-600 ${
            isScenarioOverflowing && !isScenarioExpanded ? "line-clamp-3" : ""
          }`}
        >
          {level.levelProblemStatement.description}
        </p>
        {isScenarioOverflowing ? (
          <button
            type="button"
            className="mt-1 border-0 bg-transparent p-0 text-[11px] font-bold text-brand-600 hover:underline"
            onClick={() => setIsScenarioExpanded(!isScenarioExpanded)}
          >
            {isScenarioExpanded ? "Read less" : "Read more"}
          </button>
        ) : null}
      </div>

      {/* Module Problem Statement Card */}
      {levelModule.moduleProblemStatement && (
        <div className="rounded-r-xl border border-brand-100 border-l-4 border-l-brand-600 bg-brand-50/70 p-3.5 shadow-2xs">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <TargetIcon size={13} className="shrink-0" />
            <span>Module Problem Statement</span>
          </div>
          <p className="text-[13px] leading-relaxed text-slate-800">
            {levelModule.moduleProblemStatement}
          </p>
        </div>
      )}

      {activeArtifactType ? renderArtifactPanel() : null}

      {/* Stage Info Card */}
      {!activeArtifactType ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <h4 className="mb-1.5 text-base font-bold text-brand-600">
            {formatStageLabel(activeStage)} Stage
          </h4>
          <p className="mb-2.5 text-[13px] leading-relaxed text-slate-600">{stageDescription}</p>

          <div className="text-xs text-slate-500">
            <div className="flex items-center gap-1.5 border-t border-slate-200 py-1.5">
              <ClockIcon size={13} className="shrink-0 text-slate-400" />
              <span>Est. 20-30 minutes</span>
            </div>
            <div className="flex items-center gap-1.5 border-t border-slate-200 py-1.5">
              <TargetIcon size={13} className="shrink-0 text-slate-400" />
              <span>
                {previewItems.length} content item
                {previewItems.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 border-t border-slate-200 py-1.5">
              <GraduationCapIcon size={13} className="shrink-0 text-slate-400" />
              <span>
                {formatStageLabel(activeStage)} - {stageSummary}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Curriculum Reference Card */}
      {!activeArtifactType &&
        (levelModule.prerequisites?.length ||
          levelModule.whatYoullLearn?.length ||
          levelModule.whenToApply ||
          getRecordSummary(levelModule.knowledge).length ||
          getRecordSummary(levelModule.tools).length) && (
          <div className="rounded-xl border border-success-200 bg-success-50/60 p-4 shadow-2xs">
            <div className="mb-3.5 flex items-center gap-2 border-b border-success-200 pb-2.5 text-success-700">
              <BookOpenIcon size={15} className="shrink-0" />
              <h5 className="text-[13px] font-bold">Curriculum Reference</h5>
            </div>

            <div className="space-y-3">
              {levelModule.prerequisites?.length ? (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                    <GraduationCapIcon size={12} className="shrink-0" />
                    <span>Prerequisites</span>
                  </div>
                  <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                    {levelModule.prerequisites.join(", ")}
                  </p>
                </div>
              ) : null}

              {levelModule.whatYoullLearn?.length ? (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                    <CodeXmlIcon size={12} className="shrink-0" />
                    <span>Technical Concepts</span>
                  </div>
                  <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                    {levelModule.whatYoullLearn.slice(0, 4).join(", ")}
                  </p>
                </div>
              ) : null}

              {getRecordSummary(levelModule.knowledge).length ? (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                    <LayersIcon size={12} className="shrink-0" />
                    <span>Engineering Context</span>
                  </div>
                  <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                    {getRecordSummary(levelModule.knowledge).join(", ")}
                  </p>
                </div>
              ) : null}

              {levelModule.whenToApply ? (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                    <LightbulbIcon size={12} className="shrink-0" />
                    <span>When to Use</span>
                  </div>
                  <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                    {levelModule.whenToApply}
                  </p>
                </div>
              ) : null}

              {getRecordSummary(levelModule.tools).length ? (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success-800">
                    <ChevronRightIcon size={12} className="shrink-0" />
                    <span>Module Continuity</span>
                  </div>
                  <p className="pl-5 text-[13px] leading-relaxed text-success-900">
                    {getRecordSummary(levelModule.tools).join(", ")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}

      {/* Module Context Card */}
      {!activeArtifactType &&
        (levelModule.industryChallenge || levelModule.pressurePoints?.length) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-2xs">
            <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Module Context
            </h5>
            {levelModule.industryChallenge && (
              <p className="mb-1.5 text-[13px] font-semibold leading-relaxed text-slate-800">
                {levelModule.industryChallenge}
              </p>
            )}
            {levelModule.pressurePoints?.length ? (
              <p className="text-xs leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-700">Concepts: </span>
                {levelModule.pressurePoints.join(", ")}
              </p>
            ) : null}
          </div>
        )}

      {/* Ask AI Card */}
      {!activeArtifactType ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50 p-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <MessageSquareIcon size={16} className="shrink-0 text-brand-600" />
            <div>
              <div className="text-[13px] font-bold text-slate-800">Ask AI Tutor</div>
              <div className="text-[11px] text-slate-600">Get help with this stage</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-7 rounded-lg px-3 text-xs">
            Ask
          </Button>
        </div>
      ) : null}
    </div>
  );

  const renderContentViewer = (item: EContentItem) => {
    return <ResourceContentViewer item={item} />;
  };

  const renderMainContent = () => (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      {previewItems.length ? (
        <div className="flex h-11 shrink-0 items-stretch overflow-x-auto overflow-y-hidden border-b border-line-subtle bg-surface-primary [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {previewItems.map((item) => {
            const isSelected = item.id === selectedContent?.id;
            const Icon = getContentIcon(item.contentType);
            const duration = formatDuration(item.durationSeconds);

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedContentId(item.id)}
                className={`relative flex min-w-[180px] max-w-[220px] shrink-0 items-center gap-2 px-4 text-xs font-semibold transition-colors border-r border-line-subtle ${
                  isSelected
                    ? "text-brand-600 bg-surface-primary"
                    : "text-content-muted hover:text-content-primary bg-surface-primary"
                }`}
              >
                <Icon size={13} className="shrink-0" />
                <span className="truncate">{item.title}</span>
                {duration && (
                  <span className="shrink-0 rounded-md bg-surface-muted px-2 py-1 text-[11px] text-content-muted">
                    {duration}
                  </span>
                )}
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {isSelected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-600" />}
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedContent ? (
        <section className="flex min-h-0 flex-1 flex-col bg-surface-primary">
          <div className="min-h-14 border-b border-line-subtle bg-surface-primary px-5 py-2.5 flex items-center justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-content-primary">
                {selectedContent.title}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-content-muted">
                <LightbulbIcon size={13} className="text-brand-600" />
                {formatStageLabel(activeStage)} · {formatContentType(selectedContent.contentType)}
                {formatDuration(selectedContent.durationSeconds)
                  ? ` · ${formatDuration(selectedContent.durationSeconds)}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <IconButton
                onClick={() => void handleDownloadContent(selectedContent)}
                disabled={isDownloading}
                aria-label="Download selected resource"
                icon={<DownloadIcon size={15} />}
                size="sm"
                variant="outline"
                className="rounded-lg"
              />
              <IconButton
                onClick={() => void handleExpandContent(selectedContent)}
                aria-label="Expand selected resource"
                icon={<ExpandIcon size={15} />}
                size="sm"
                variant="outline"
                className="rounded-lg"
              />
            </div>
          </div>

          <div
            ref={contentViewerRef}
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-surface-muted"
          >
            {renderContentViewer(selectedContent)}
          </div>

          {renderStageNavigationBar()}
        </section>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-secondary p-6">
          <div className="max-w-md text-center">
            <h2 className="text-base font-bold text-content-primary mb-2">{levelModule.title}</h2>
            <p className="text-xs text-content-secondary">
              No learning content is available for this stage yet.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-secondary">
      <LevelHeader
        levelTitle={level.title}
        activeStage={activeStage}
        isModulesOpen={isModulesOpen}
        isStageInfoOpen={isStageInfoOpen}
        onBackClick={handleBackToOverview}
        onOverviewClick={handleBackToOverview}
        onToggleModules={handleToggleModules}
        onToggleStageInfo={handleToggleStageInfo}
      />

      <StageStepperBar
        activeStage={activeStage}
        completedStages={completedStages}
        stageOverrides={stageStepperOverrides}
        onStageSelect={handleStageSelect}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {isModulesOpen && (
          <ModulesDrawer
            activeModuleNo={moduleNumber}
            modules={moduleDrawerItems}
            onSelectModule={handleModuleSelect}
            onClose={() => setIsModulesOpen(false)}
            className="hidden lg:flex"
          />
        )}

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-surface-secondary">
          <div className="min-h-0 flex-1">{renderMainContent()}</div>
        </div>

        {isStageInfoOpen && (
          <aside
            className={`hidden min-h-0 shrink-0 flex-col overflow-hidden border-l border-slate-200/80 bg-white font-sans select-none transition-all duration-200 lg:flex ${
              isStageInfoExpanded ? "w-[500px] max-w-[70vw]" : "w-[340px]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-4 sm:py-3.5">
              <h2 className="text-[11px] sm:text-xs font-bold tracking-widest text-slate-800 uppercase">
                {rightPanelTitle}
              </h2>
              <div className="flex items-center gap-1">
                <IconButton
                  aria-label={isStageInfoExpanded ? "Collapse stage info" : "Expand stage info"}
                  icon={<ExpandIcon size={13} />}
                  size="sm"
                  variant="outline"
                  onClick={handleExpandStageInfo}
                />
                <IconButton
                  aria-label="Close stage info"
                  icon={<CloseIcon size={13} />}
                  size="sm"
                  variant="outline"
                  onClick={handleToggleStageInfo}
                />
              </div>
            </div>
            {renderStageInfoPanel()}
          </aside>
        )}

        {mobilePanelOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <button
              type="button"
              aria-label="Close course side panel"
              className="fixed inset-0 bg-black/40 backdrop-blur-xs border-0 p-0"
              onClick={() => setMobilePanelOpen(null)}
            />
            {mobilePanelOpen === "modules" ? (
              <ModulesDrawer
                activeModuleNo={moduleNumber}
                modules={moduleDrawerItems}
                onSelectModule={handleModuleSelect}
                onClose={() => setMobilePanelOpen(null)}
                className="relative z-10 w-72 h-full shadow-2xl"
              />
            ) : (
              <aside className="relative z-10 w-80 bg-white h-full ml-auto shadow-2xl flex flex-col">
                <div className="p-4 border-b border-line-subtle flex items-center justify-between">
                  <h2 className="text-xs font-bold tracking-wider text-content-secondary uppercase">
                    {rightPanelTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMobilePanelOpen(null)}
                    className="text-content-secondary hover:text-content-primary text-xs font-bold p-1"
                  >
                    Close
                  </button>
                </div>
                {renderStageInfoPanel()}
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
