import type React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  type EContentItem,
  fetchLevelDetails,
  fetchLevelModuleDetails,
  getLevelContentQueryKey,
  type ModuleArtifact,
  type ModuleDetailsResponse,
  type ModuleStageContent,
  ResourceContentViewer,
  useLevelContentData,
  useStartModuleProgress,
  useUpdateStageProgress,
} from "@/entities/course";
import { useModuleNavigationStore } from "@/features/module-navigation";
import { XpRewardModal } from "@/features/xp-reward";
import {
  Button,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DocumentIcon,
  DownloadIcon,
  ExpandIcon,
  IconButton,
  type IconProps,
  LabFlaskIcon,
  LightbulbIcon,
  LightningBoltIcon,
  PlayIcon,
  toast,
} from "@/shared/ui";
import {
  LevelHeader,
  type LteStage,
  type ModuleItem,
  ModulesDrawer,
  StageStepperBar,
} from "@/widgets";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { StageInfoPanel } from "./components/StageInfoPanel";

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

const getModuleStageSequence = (stages: ModuleStageContent[] | undefined) => {
  const stageNames = new Set(
    (stages ?? [])
      .map((stage) => stage.stageName.toLowerCase() as LteStage)
      .filter((stage) => STAGES.includes(stage)),
  );

  return stageNames.size ? STAGES.filter((stage) => stageNames.has(stage)) : STAGES;
};

const getFirstIncompleteStage = (stages: LteStage[], completedStages: Set<LteStage>) =>
  stages.find((stage) => !completedStages.has(stage)) ?? null;

export const LevelContentPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { levelId, moduleNo } = useParams<{ levelId: string; moduleNo: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const startModuleNavigation = useModuleNavigationStore((state) => state.startModuleNavigation);
  const clearModuleNavigation = useModuleNavigationStore((state) => state.clearModuleNavigation);

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

  const [showXpModal, setShowXpModal] = useState(false);
  const [xpAwardedAmount, setXpAwardedAmount] = useState(0);
  const [totalXpAmount, setTotalXpAmount] = useState(0);
  const [pendingNextStage, setPendingNextStage] = useState<LteStage | null>(null);
  const [pendingNextModuleNo, setPendingNextModuleNo] = useState<number | null>(null);

  const moduleNumber = Number(moduleNo);
  const hasValidRouteParams = Boolean(levelId) && Number.isInteger(moduleNumber);
  const { data, isLoading, isError } = useLevelContentData(
    levelId,
    hasValidRouteParams ? moduleNumber : undefined,
  );
  const nextModuleNoForPrefetch = Number.isInteger(moduleNumber) ? moduleNumber + 1 : undefined;
  const nextModuleExistsForPrefetch = Boolean(
    nextModuleNoForPrefetch &&
      data?.level.modules.some((module) => module.moduleNo === nextModuleNoForPrefetch),
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

  const { mutate: startModule } = useStartModuleProgress();
  const { mutate: updateStage, isPending: isUpdateStagePending } = useUpdateStageProgress();

  useEffect(() => {
    if (levelId && Number.isInteger(moduleNumber)) {
      startModule({ levelId, moduleNo: moduleNumber });
    }
  }, [levelId, moduleNumber, startModule]);

  useEffect(() => {
    if (!data && !isLoading) return;
    clearModuleNavigation();
  }, [clearModuleNavigation, data, isLoading]);

  useEffect(() => {
    if (!levelId || !nextModuleNoForPrefetch || !nextModuleExistsForPrefetch) return;

    void queryClient.prefetchQuery({
      queryKey: getLevelContentQueryKey(levelId, nextModuleNoForPrefetch),
      queryFn: async () => {
        const [level, module] = await Promise.all([
          fetchLevelDetails(levelId),
          fetchLevelModuleDetails(levelId, nextModuleNoForPrefetch),
        ]);

        return { level, module };
      },
      staleTime: 1000 * 60 * 5,
    });
  }, [levelId, nextModuleExistsForPrefetch, nextModuleNoForPrefetch, queryClient]);

  const levelModuleForSync = data?.module;
  const activeStageContentForSync = levelModuleForSync?.stages.find(
    (stage) => stage.stageName === activeStage,
  );
  const previewItemsForSync = activeStageContentForSync?.items ?? [];
  const selectedContentForSync =
    previewItemsForSync.find((item) => item.id === selectedContentId) ??
    previewItemsForSync[0] ??
    null;

  useEffect(() => {
    if (levelId && Number.isInteger(moduleNumber) && selectedContentForSync?.id) {
      updateStage({
        levelId,
        moduleNo: moduleNumber,
        eContentId: selectedContentForSync.id,
        stageName: activeStage,
        status: "in_progress",
      });
    }
  }, [levelId, moduleNumber, selectedContentForSync?.id, activeStage, updateStage]);

  const handleStageSelect = (stage: LteStage) => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      updated.set("stage", stage);
      return updated;
    });
  };

  const handleModuleSelect = (targetModuleNo: number) => {
    if (!levelId) return;
    navigate(`/my-courses/${levelId}/modules/${targetModuleNo}?stage=engage`);
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

  const routeStageSequence = getModuleStageSequence(data?.module.stages);
  const routeCompletedStageSet = new Set((data?.module.completedStages || []) as LteStage[]);
  const routeFirstIncompleteStage = getFirstIncompleteStage(
    routeStageSequence,
    routeCompletedStageSet,
  );
  const isRouteStageLocked = Boolean(
    routeFirstIncompleteStage &&
      !routeCompletedStageSet.has(activeStage) &&
      activeStage !== routeFirstIncompleteStage,
  );

  useEffect(() => {
    if (!data) return;

    const fallbackStage = routeFirstIncompleteStage ?? routeStageSequence[0] ?? "engage";
    if (!routeStageSequence.includes(activeStage) || isRouteStageLocked) {
      setSelectedContentId(null);
      setSearchParams((prev) => {
        const updated = new URLSearchParams(prev);
        updated.set("stage", fallbackStage);
        return updated;
      });
    }
  }, [
    activeStage,
    data,
    isRouteStageLocked,
    routeFirstIncompleteStage,
    routeStageSequence,
    setSearchParams,
  ]);

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

  const completedStages = (levelModule.completedStages || []) as LteStage[];
  const previewItems = activeStageContent.items;
  const stageSummary = getStageSummary(levelModule, activeStageContent);
  const stageDescription = activeStageContent.stageDescription;
  const navigableStages = routeStageSequence;
  const completedStageSet = new Set(completedStages);
  const activeStageIndex = navigableStages.indexOf(activeStage);
  const previousStage: LteStage | null =
    activeStageIndex > 0 ? (navigableStages[activeStageIndex - 1] ?? null) : null;
  const nextStage: LteStage | null =
    activeStageIndex >= 0 && activeStageIndex < navigableStages.length - 1
      ? (navigableStages[activeStageIndex + 1] ?? null)
      : null;

  const isCurrentStageCompleted = completedStageSet.has(activeStage);
  const isModuleComplete = navigableStages.every((stage) => completedStageSet.has(stage));
  const isModuleCompleteAfterCurrentStage = navigableStages.every(
    (stage) => stage === activeStage || completedStageSet.has(stage),
  );
  const firstIncompleteStage = getFirstIncompleteStage(navigableStages, completedStageSet);
  const nextIncompleteStageAfterCurrent = navigableStages
    .slice(activeStageIndex + 1)
    .find((stage) => !completedStageSet.has(stage));
  const nextStageAfterCurrentCompletion = isModuleCompleteAfterCurrentStage
    ? nextStage
    : (nextIncompleteStageAfterCurrent ?? firstIncompleteStage);
  const isStageLocked = (stage: LteStage) =>
    Boolean(
      firstIncompleteStage && !completedStageSet.has(stage) && stage !== firstIncompleteStage,
    );

  // Check if there's a next module
  const nextModuleNo = moduleNumber + 1;
  const nextModuleExists = level.modules.some((m) => m.moduleNo === nextModuleNo);

  const selectedContent =
    previewItems.find((item) => item.id === selectedContentId) ?? previewItems[0] ?? null;
  const selectedContentIndex = selectedContent
    ? previewItems.findIndex((item) => item.id === selectedContent.id)
    : -1;
  const nextContent =
    selectedContentIndex >= 0 ? (previewItems[selectedContentIndex + 1] ?? null) : null;
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
    const progressPercentage = isCurrentModule
      ? (levelModule.progressPercentage ?? m.progressPercentage ?? 0)
      : (m.progressPercentage ?? 0);
    const isCompleted = isCurrentModule
      ? levelModule.progressPercentage === 100 || m.isCompleted || false
      : m.progressPercentage === 100 || m.isCompleted || false;

    return {
      id: m.id,
      moduleNo: m.moduleNo,
      title: m.title,
      progressPercentage,
      isCompleted,
      stageProgressDots: isCurrentModule
        ? levelModule.stages.map((stage) => {
            const name = stage.stageName.toLowerCase() as LteStage;
            if (name === activeStage) return "blue";
            if (completedStages.includes(name)) return "green";
            return "gray";
          })
        : undefined,
    };
  });

  const handleCloseXpModal = () => {
    setShowXpModal(false);
    if (pendingNextStage) {
      setPendingNextStage(null);
      setSelectedContentId(null);
      handleStageSelect(pendingNextStage);
    } else if (pendingNextModuleNo && levelId) {
      const moduleToOpen = pendingNextModuleNo;
      setPendingNextModuleNo(null);
      setSelectedContentId(null);
      navigate(`/my-courses/${encodeURIComponent(levelId)}/modules/${moduleToOpen}?stage=engage`);
    } else {
      toast.success("Course completed successfully!");
      navigate("/my-courses");
    }
  };

  const handleStageNavigation = (stage: LteStage | null) => {
    if (!stage || isStageLocked(stage)) return;
    setSelectedContentId(null);
    handleStageSelect(stage);
  };

  const handleNextModule = () => {
    if (!levelId || !nextModuleExists) return;
    startModuleNavigation(levelId, nextModuleNo);
    setSelectedContentId(null);
    navigate(`/my-courses/${encodeURIComponent(levelId)}/modules/${nextModuleNo}?stage=engage`);
  };

  const handleCompleteCourse = () => {
    toast.success("Course completed successfully!");
    navigate("/my-courses");
  };

  const handleAdvanceBeyondStage = () => {
    if (nextStage) {
      handleStageNavigation(nextStage);
      return;
    }

    if (!isModuleComplete) {
      handleStageNavigation(firstIncompleteStage);
      return;
    }

    if (nextModuleExists) {
      handleNextModule();
    } else {
      handleCompleteCourse();
    }
  };

  const handleMarkStageDone = () => {
    if (!levelId) return;

    if (selectedContent?.id) {
      updateStage(
        {
          levelId,
          moduleNo: moduleNumber,
          eContentId: selectedContent.id,
          stageName: activeStage,
          status: "completed",
        },
        {
          onSuccess: (data) => {
            if (data?.xpAwarded && data.xpAwarded > 0) {
              setXpAwardedAmount(data.xpAwarded);
              setTotalXpAmount(data.totalXp ?? 0);
              setPendingNextStage(nextStageAfterCurrentCompletion);
              setPendingNextModuleNo(
                isModuleCompleteAfterCurrentStage && nextModuleExists ? nextModuleNo : null,
              );
              setShowXpModal(true);
            } else {
              if (nextStageAfterCurrentCompletion) {
                handleStageNavigation(nextStageAfterCurrentCompletion);
              } else if (isModuleCompleteAfterCurrentStage && nextModuleExists) {
                handleNextModule();
              } else {
                handleCompleteCourse();
              }
            }
          },
          onError: (err) => {
            toast.error(`Failed to save progress: ${err.message}`);
          },
        },
      );
    } else {
      handleAdvanceBeyondStage();
    }
  };

  const handlePrimaryNext = () => {
    if (nextContent) {
      setSelectedContentId(nextContent.id);
      return;
    }

    if (isCurrentStageCompleted) {
      handleAdvanceBeyondStage();
      return;
    }

    handleMarkStageDone();
  };

  const primaryNextLabel = isCurrentStageCompleted
    ? nextContent || nextStage || !isModuleComplete
      ? "Next"
      : nextModuleExists
        ? "Next Module"
        : "Complete Course"
    : nextContent || nextStage || !isModuleCompleteAfterCurrentStage
      ? "Mark Done & Next"
      : nextModuleExists
        ? "Mark Done & Next Module"
        : "Mark Done & Complete Course";

  const renderStageNavigationBar = () => (
    <div className="sticky bottom-0 z-20 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-line-default bg-surface-primary px-4 shadow-[0_-4px_12px_rgba(15,23,42,0.05)]">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start text-content-muted"
        disabled={!previousStage || isStageLocked(previousStage)}
        icon={<ChevronLeftIcon size={16} />}
        onClick={() => handleStageNavigation(previousStage)}
      >
        Previous
      </Button>

      <div className="flex items-center gap-1.5">
        {STAGES.map((stage) => {
          const isCompleted = completedStages.includes(stage);
          const isLocked = isStageLocked(stage);
          return (
            <button
              key={stage}
              type="button"
              aria-label={`Go to ${formatStageLabel(stage)} stage`}
              disabled={isLocked}
              className={`h-2 rounded-full transition-all ${
                stage === activeStage
                  ? "w-6 bg-brand-600"
                  : isCompleted
                    ? "w-6 bg-success-500"
                    : isLocked
                      ? "w-2 bg-line-subtle opacity-50 cursor-not-allowed"
                      : "w-2 bg-line-strong"
              }`}
              onClick={() => handleStageNavigation(stage)}
            />
          );
        })}
      </div>

      <Button
        type="button"
        size="sm"
        className="justify-self-end"
        onClick={handlePrimaryNext}
        disabled={isUpdateStagePending}
      >
        <span className="inline-flex items-center gap-2">
          {primaryNextLabel}
          {primaryNextLabel === "Complete Course" ? (
            <CheckIcon size={16} />
          ) : (
            <ChevronRightIcon size={16} />
          )}
        </span>
      </Button>
    </div>
  );

  const renderStageInfoPanel = () => (
    <StageInfoPanel
      level={level}
      levelModule={levelModule}
      activeStage={activeStage}
      activeArtifactType={activeArtifactType}
      stageDescription={stageDescription}
      stageSummary={stageSummary}
      previewItems={previewItems}
      isScenarioExpanded={isScenarioExpanded}
      isScenarioOverflowing={isScenarioOverflowing}
      setIsScenarioExpanded={setIsScenarioExpanded}
      scenarioTextRef={scenarioTextRef}
      formatStageLabel={formatStageLabel}
      renderArtifactPanel={() => (
        <ArtifactPanel
          activeArtifact={activeArtifact}
          activeArtifactType={activeArtifactType}
          rightPanelTitle={rightPanelTitle}
          expandedArtifactQuestionId={expandedArtifactQuestionId}
          setExpandedArtifactQuestionId={setExpandedArtifactQuestionId}
        />
      )}
    />
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
        isStageDisabled={isStageLocked}
        onStageSelect={handleStageNavigation}
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
            className={`hidden min-h-0 shrink-0 flex-col overflow-hidden border-l border-border-default/80 bg-white font-sans select-none transition-all duration-200 lg:flex ${
              isStageInfoExpanded ? "w-[500px] max-w-[70vw]" : "w-[340px]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 sm:px-4 sm:py-3.5">
              <h2 className="text-[11px] sm:text-xs font-bold tracking-widest text-content-heading uppercase">
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

        <XpRewardModal
          isOpen={showXpModal}
          xpAmount={xpAwardedAmount}
          totalXp={totalXpAmount}
          stageName={activeStage}
          onClose={handleCloseXpModal}
        />
      </div>
    </div>
  );
};
