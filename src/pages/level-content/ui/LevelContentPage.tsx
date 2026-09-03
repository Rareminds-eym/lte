import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  type EContentItem,
  fetchLevelModuleDetails,
  getLevelModuleDetailsQueryKey,
  isLteStageName,
  type LteStage,
  ResourceContentViewer,
  useLevelDetails,
  useLevelModuleDetails,
  useStartModuleProgress,
  useUpdateStageProgress,
} from "@/entities/course";
import { DASHBOARD_QUERY_KEY } from "@/entities/dashboard";
import { useXpModalStore } from "@/shared/store";
import {
  Button,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ExpandIcon,
  IconButton,
  type IconProps,
  LightbulbIcon,
  toast,
} from "@/shared/ui";
import { LevelHeader, type ModuleItem, ModulesDrawer, StageStepperBar } from "@/widgets";
import { ArtifactPanel } from "./components/ArtifactPanel";
import {
  formatContentType,
  formatDuration,
  formatStageLabel,
  getArtifactPanelTitle,
  getArtifactStepperMeta,
  getArtifactStepperMetaByType,
  getContentIcon,
  getCourseOverviewPath,
  getFirstIncompleteStage,
  getModuleStageSequence,
  getPrimaryArtifact,
  getStageSummary,
  LEVEL_CONTENT_UNAVAILABLE_MESSAGE,
} from "./components/levelContentUtils";
import { ModuleLoadingShell } from "./components/ModuleLoadingShell";
import { SilentContentTimer } from "./components/SilentContentTimer";
import { StageInfoPanel } from "./components/StageInfoPanel";

export const LevelContentPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { levelId, moduleNo } = useParams<{ levelId: string; moduleNo: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isModulesOpen, setIsModulesOpen] = useState(true);
  const [isStageInfoOpen, setIsStageInfoOpen] = useState(true);
  const [isStageInfoExpanded, setIsStageInfoExpanded] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<"modules" | "stageInfo" | null>(null);
  const [prevModuleId, setPrevModuleId] = useState<string | undefined>(undefined);
  const [isScenarioExpanded, setIsScenarioExpanded] = useState(false);
  const [expandedArtifactQuestionId, setExpandedArtifactQuestionId] = useState<
    string | null | undefined
  >();
  const contentViewerRef = useRef<HTMLDivElement>(null);
  const addEvent = useXpModalStore((s) => s.addEvent);

  const [totalXpAmount, setTotalXpAmount] = useState(0);
  const [optimisticCompletedStages, setOptimisticCompletedStages] = useState<LteStage[]>([]);
  const [submittedArtifactIds, setSubmittedArtifactIds] = useState<string[]>([]);

  const moduleNumber = Number(moduleNo);
  const hasValidRouteParams = Boolean(levelId) && Number.isInteger(moduleNumber);
  const {
    data: level,
    isLoading: isLevelLoading,
    isError: isLevelError,
    refetch: refetchLevel,
  } = useLevelDetails(levelId);
  const {
    data: levelModule,
    isLoading: isModuleLoading,
    isError: isModuleError,
    refetch: refetchModule,
  } = useLevelModuleDetails(levelId, hasValidRouteParams ? moduleNumber : undefined);
  const data = useMemo(
    () => (level && levelModule ? { level, module: levelModule } : undefined),
    [level, levelModule],
  );

  if (levelModule?.id !== prevModuleId) {
    setPrevModuleId(levelModule?.id);
    setOptimisticCompletedStages([]);
    setSubmittedArtifactIds([]);
    setIsScenarioExpanded(false);
  }
  const nextModuleNoForPrefetch = Number.isInteger(moduleNumber) ? moduleNumber + 1 : undefined;
  const nextModuleExistsForPrefetch = Boolean(
    nextModuleNoForPrefetch &&
      level?.modules.some((module) => module.moduleNo === nextModuleNoForPrefetch),
  );

  const rawStage = searchParams.get("stage")?.toLowerCase();
  const activeStage: LteStage = isLteStageName(rawStage) ? (rawStage as LteStage) : "engage";
  const routeContentId = searchParams.get("content");
  const handleBackToOverview = () => {
    navigate(getCourseOverviewPath(level?.capabilityCode));
  };

  const { mutate: startModule } = useStartModuleProgress();
  const { mutate: updateStage, isPending: isUpdateStagePending } = useUpdateStageProgress();

  useEffect(() => {
    if (levelId && Number.isInteger(moduleNumber)) {
      startModule({ levelId, moduleNo: moduleNumber });
    }
  }, [levelId, moduleNumber, startModule]);

  useEffect(() => {
    if (!levelId || !nextModuleNoForPrefetch || !nextModuleExistsForPrefetch) return;

    void queryClient.prefetchQuery({
      queryKey: getLevelModuleDetailsQueryKey(levelId, nextModuleNoForPrefetch),
      queryFn: () => fetchLevelModuleDetails(levelId, nextModuleNoForPrefetch),
      staleTime: 1000 * 60 * 5,
    });
  }, [levelId, nextModuleExistsForPrefetch, nextModuleNoForPrefetch, queryClient]);

  const levelModuleForSync = data?.module;
  const activeStageContentForSync = levelModuleForSync?.stages.find(
    (stage) => stage.stageName === activeStage,
  );
  const previewItemsForSync = activeStageContentForSync?.items ?? [];
  const selectedContentForSync =
    previewItemsForSync.find((item) => item.id === routeContentId) ??
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
      updated.delete("content");
      return updated;
    });
  };

  const handleContentSelect = (contentId: string) => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      updated.set("stage", activeStage);
      updated.set("content", contentId);
      return updated;
    });
  };

  const handleModuleSelect = (targetModuleNumber: number) => {
    if (!levelId) return;
    navigate(`/my-courses/${levelId}/modules/${targetModuleNumber}?stage=engage`);
    setMobilePanelOpen(null);
  };

  const handleToggleModules = () => {
    setMobilePanelOpen((prev) => (prev === "modules" ? null : "modules"));
  };

  const handleToggleStageInfo = () => {
    setMobilePanelOpen((prev) => (prev === "stageInfo" ? null : "stageInfo"));
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

  const renderUnavailableState = (message: string, onRetry?: () => void) => (
    <div
      className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-line-subtle text-center max-w-md w-full"
      role="alert"
    >
      <h3 className="text-base md:text-lg font-bold text-content-primary mb-2">
        Course Content Not Available
      </h3>
      <p className="text-xs text-content-secondary mb-4">{message}</p>
      <div className="flex justify-center gap-2">
        {onRetry && (
          <Button type="button" onClick={onRetry} size="sm" variant="primary">
            Retry
          </Button>
        )}
        <Button
          type="button"
          onClick={handleBackToOverview}
          size="sm"
          variant={onRetry ? "outline" : "primary"}
        >
          Back to Courses
        </Button>
      </div>
    </div>
  );

  const routeStageSequence = getModuleStageSequence(data?.module.stages);
  const routeCompletedStageSet = new Set([
    ...((data?.module.completedStages || []) as LteStage[]),
    ...optimisticCompletedStages,
  ]);
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

    // A locked stage must ALWAYS redirect to the first incomplete stage.
    // Trusting the existing ?stage= value here would render locked content on
    // deep links (regression); validate any pre-existing value instead.
    if (isRouteStageLocked && routeFirstIncompleteStage) {
      setSearchParams((prev) => {
        const updated = new URLSearchParams(prev);
        updated.set("stage", routeFirstIncompleteStage);
        updated.delete("content");
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

  if (isLevelLoading) {
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

  if (isLevelError || isModuleError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-secondary p-4">
        {renderUnavailableState(LEVEL_CONTENT_UNAVAILABLE_MESSAGE, () => {
          void refetchLevel();
          void refetchModule();
        })}
      </div>
    );
  }

  if (!level) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-secondary p-4">
        {renderUnavailableState(LEVEL_CONTENT_UNAVAILABLE_MESSAGE)}
      </div>
    );
  }

  if (isModuleLoading || !levelModule) {
    const activeModuleSummary = level.modules.find((module) => module.moduleNo === moduleNumber);

    return (
      <ModuleLoadingShell
        level={level}
        moduleNumber={moduleNumber}
        activeStage={activeStage}
        completedStages={(activeModuleSummary?.completedStages || []) as LteStage[]}
        isModulesOpen={isModulesOpen}
        isStageInfoOpen={isStageInfoOpen}
        onBackToOverview={handleBackToOverview}
        onToggleModules={handleToggleModules}
        onToggleStageInfo={handleToggleStageInfo}
        onSelectModule={handleModuleSelect}
        onCloseModules={() => setIsModulesOpen(false)}
      />
    );
  }

  const activeStageContent = levelModule.stages.find((stage) => stage.stageName === activeStage);

  if (!activeStageContent) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-secondary p-4">
        {renderUnavailableState(LEVEL_CONTENT_UNAVAILABLE_MESSAGE)}
      </div>
    );
  }

  const resolvedLevelId = levelId as string;

  const completedStages = Array.from(
    new Set([...(levelModule.completedStages || []), ...optimisticCompletedStages]),
  ) as LteStage[];
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
  const isArtifactSubmitted = (artifactId: string, submittedFiles?: unknown[]) =>
    (submittedFiles?.length ?? 0) > 0 || submittedArtifactIds.includes(artifactId);
  const finalArtifactStageIndex = navigableStages.findIndex((stageName) => {
    const stage = levelModule.stages.find((moduleStage) => moduleStage.stageName === stageName);
    return stage?.artifacts.some(
      (artifact) =>
        artifact.artifactType === "final" &&
        artifact.isActive &&
        !isArtifactSubmitted(artifact.id, artifact.submittedFiles),
    );
  });
  const activeStageHasUnsubmittedFinalArtifact = activeStageContent.artifacts.some(
    (artifact) =>
      artifact.artifactType === "final" &&
      artifact.isActive &&
      !isArtifactSubmitted(artifact.id, artifact.submittedFiles),
  );
  const isStageAfterUnsubmittedFinalArtifact = (stage: LteStage) =>
    finalArtifactStageIndex >= 0 && navigableStages.indexOf(stage) > finalArtifactStageIndex;
  const isStageLockedForCompletedSet = (stage: LteStage, stageSet: Set<LteStage>) => {
    if (isStageAfterUnsubmittedFinalArtifact(stage)) return true;

    const firstAvailableStage = getFirstIncompleteStage(navigableStages, stageSet);
    return Boolean(firstAvailableStage && !stageSet.has(stage) && stage !== firstAvailableStage);
  };
  const isStageLocked = (stage: LteStage) => isStageLockedForCompletedSet(stage, completedStageSet);

  // Check if there's a next module
  const nextModuleNo = moduleNumber + 1;
  const nextModuleExists = level.modules.some((m) => m.moduleNo === nextModuleNo);

  const selectedContent =
    previewItems.find((item) => item.id === routeContentId) ?? previewItems[0] ?? null;
  const selectedContentIndex = selectedContent
    ? previewItems.findIndex((item) => item.id === selectedContent.id)
    : -1;
  const activeStageProgress =
    selectedContentIndex >= 0 && previewItems.length > 0
      ? Math.round(((selectedContentIndex + 1) / previewItems.length) * 100)
      : 0;
  const stageProgress = navigableStages.reduce<Partial<Record<LteStage, number>>>(
    (progressByStage, stage) => {
      progressByStage[stage] = completedStageSet.has(stage)
        ? 100
        : stage === activeStage
          ? activeStageProgress
          : 0;
      return progressByStage;
    },
    {},
  );
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
    const artifactMeta =
      getArtifactStepperMetaByType(stage.artifactType) ??
      getArtifactStepperMeta(getPrimaryArtifact(stage.artifacts));
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

  const triggerNavigationTransition = (
    source: "stage_complete" | "artifact_submit" | "level_complete",
    pendingStage: LteStage | null,
    pendingModule: number | null,
  ) => {
    if (source === "artifact_submit") {
      return;
    }

    if (source === "level_complete") {
      toast.success("Level completed successfully!");
      if (level?.capabilityCode) {
        navigate(getCourseOverviewPath(level.capabilityCode));
      }
      return;
    }

    if (pendingStage) {
      if (isStageAfterUnsubmittedFinalArtifact(pendingStage)) return;
      handleStageSelect(pendingStage);
    } else if (pendingModule && levelId) {
      if (finalArtifactStageIndex >= 0) return;
      navigate(`/my-courses/${encodeURIComponent(levelId)}/modules/${pendingModule}?stage=engage`);
    } else {
      if (finalArtifactStageIndex >= 0) return;
      toast.success("Course completed successfully!");
      if (level?.capabilityCode) {
        navigate(getCourseOverviewPath(level.capabilityCode));
      }
    }
  };

  const handleStageNavigation = (
    stage: LteStage | null,
    stageSet: Set<LteStage> = completedStageSet,
  ) => {
    if (!stage || isStageLockedForCompletedSet(stage, stageSet)) return;
    handleStageSelect(stage);
  };

  const handleNextModule = () => {
    if (!levelId || !nextModuleExists) return;
    if (finalArtifactStageIndex >= 0) return;
    navigate(`/my-courses/${encodeURIComponent(levelId)}/modules/${nextModuleNo}?stage=engage`);
  };

  const handleCompleteCourse = () => {
    if (finalArtifactStageIndex >= 0) return;
    toast.success("Course completed successfully!");
    navigate(getCourseOverviewPath(level.capabilityCode));
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
            void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
            const completedStageSetAfterSave = new Set([...completedStageSet, activeStage]);

            setOptimisticCompletedStages((currentStages) =>
              currentStages.includes(activeStage) ? currentStages : [...currentStages, activeStage],
            );

            if (data?.levelCompleted) {
              const awarded = data.levelXpAwarded ?? 0;
              const total = data.totalXp ?? 0;
              setTotalXpAmount(total);
              addEvent({
                id: crypto.randomUUID(),
                xpAmount: awarded,
                totalXp: total,
                eventType: "course_completed_on_time",
                xpCategory: "evidence",
                onClose: () => triggerNavigationTransition("level_complete", null, null),
              });
            } else if (data?.xpAwarded && data.xpAwarded > 0) {
              const awarded = data.xpAwarded;
              const total = data.totalXp ?? 0;
              setTotalXpAmount(total);
              const pStage = nextStageAfterCurrentCompletion;
              const pModule =
                isModuleCompleteAfterCurrentStage && nextModuleExists ? nextModuleNo : null;
              addEvent({
                id: crypto.randomUUID(),
                xpAmount: awarded,
                totalXp: total,
                eventType: activeStage,
                xpCategory: (data.xpCategory as "evidence" | "engagement") ?? "evidence",
                onClose: () => triggerNavigationTransition("stage_complete", pStage, pModule),
              });
            } else {
              if (nextStageAfterCurrentCompletion) {
                handleStageNavigation(nextStageAfterCurrentCompletion, completedStageSetAfterSave);
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
      handleContentSelect(nextContent.id);
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
        : "Finish Course";
  const isPrimaryNextBlockedByFinalArtifact =
    activeStageHasUnsubmittedFinalArtifact && !nextContent;

  const renderStageNavigationBar = () => (
    <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between border-t border-line-subtle bg-surface-primary px-5 py-3 sm:px-6">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="!rounded-full h-8 sm:h-9 px-4 sm:px-5 border border-line-default bg-surface-primary text-content-muted hover:text-content-primary hover:bg-surface-subtle text-xs font-medium gap-1.5 shadow-none transition-colors"
        disabled={!previousStage || isStageLocked(previousStage)}
        icon={<ChevronLeftIcon size={14} className="text-content-muted" />}
        onClick={() => handleStageNavigation(previousStage)}
      >
        <span>Previous</span>
      </Button>

      <div className="hidden items-center justify-center gap-1.5 sm:flex">
        {navigableStages.map((stage) => {
          const isCompleted = completedStageSet.has(stage);
          const isLocked = isStageLocked(stage);
          const isActive = stage === activeStage;
          return (
            <button
              key={stage}
              type="button"
              aria-label={`Go to ${formatStageLabel(stage)} stage`}
              disabled={isLocked}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                isActive
                  ? "w-8 bg-brand-600"
                  : isCompleted
                    ? "w-7 bg-success-500"
                    : isLocked
                      ? "w-6 bg-line-subtle opacity-50 cursor-not-allowed"
                      : "w-6 bg-line-default hover:bg-line-strong cursor-pointer"
              }`}
              onClick={() => handleStageNavigation(stage)}
            />
          );
        })}
      </div>

      <Button
        type="button"
        size="sm"
        className="!rounded-full h-8 sm:h-9 px-5 sm:px-6 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold gap-1.5 shadow-none transition-all flex items-center"
        onClick={handlePrimaryNext}
        disabled={isUpdateStagePending || isPrimaryNextBlockedByFinalArtifact}
      >
        <span className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap text-center leading-tight">
          {primaryNextLabel}
          {primaryNextLabel === "Complete Course" || primaryNextLabel === "Finish Course" ? (
            <CheckIcon size={14} />
          ) : (
            <ChevronRightIcon size={14} />
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
      stageModuleContext={activeStageContent.moduleContext}
      stageCurriculumReference={activeStageContent.curriculumReference}
      stageSummary={stageSummary}
      previewItems={previewItems}
      isScenarioExpanded={isScenarioExpanded}
      setIsScenarioExpanded={setIsScenarioExpanded}
      formatStageLabel={formatStageLabel}
      renderArtifactPanel={() => (
        <ArtifactPanel
          activeArtifact={activeArtifact}
          activeArtifactType={activeArtifactType}
          rightPanelTitle={rightPanelTitle}
          isPanelExpanded={isStageInfoExpanded}
          expandedArtifactQuestionId={expandedArtifactQuestionId}
          setExpandedArtifactQuestionId={setExpandedArtifactQuestionId}
          onXpEarned={(xpAmount, eventType) => {
            setTotalXpAmount((prev) => prev + xpAmount);
            addEvent({
              id: crypto.randomUUID(),
              xpAmount: xpAmount,
              totalXp: totalXpAmount + xpAmount,
              eventType: eventType,
              xpCategory: "evidence",
              onClose: () => triggerNavigationTransition("artifact_submit", null, null),
            });
          }}
          onArtifactSubmitted={(artifactId) => {
            setSubmittedArtifactIds((currentIds) =>
              currentIds.includes(artifactId) ? currentIds : [...currentIds, artifactId],
            );
          }}
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
                onClick={() => handleContentSelect(item.id)}
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
          <SilentContentTimer
            contentId={selectedContent.id}
            levelId={resolvedLevelId}
            moduleNo={moduleNumber}
            stageName={activeStage}
            updateStage={updateStage}
          />

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
          isModulesOpen={mobilePanelOpen === "modules"}
          isStageInfoOpen={mobilePanelOpen === "stageInfo"}
          onBackClick={handleBackToOverview}
          onOverviewClick={handleBackToOverview}
          onToggleModules={handleToggleModules}
        onToggleStageInfo={handleToggleStageInfo}
      />

      <StageStepperBar
        activeStage={activeStage}
        completedStages={completedStages}
        stageProgress={stageProgress}
        stageOverrides={stageStepperOverrides}
        isStageDisabled={isStageLocked}
        onStageSelect={handleStageNavigation}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden p-2.5 sm:p-3 gap-2.5 sm:gap-3 bg-surface-secondary">
        {isModulesOpen && (
          <ModulesDrawer
            activeModuleNo={moduleNumber}
            modules={moduleDrawerItems}
            onSelectModule={handleModuleSelect}
            onClose={() => setIsModulesOpen(false)}
            className="hidden lg:flex rounded-2xl border border-line-default bg-surface-primary shadow-xs"
          />
        )}

        {!isModulesOpen && (
          <button
            type="button"
            aria-label="Open modules panel"
            title="Open modules panel"
            onClick={() => setIsModulesOpen(true)}
            className="absolute left-3 top-1/2 z-20 hidden h-12 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-r-xl border border-l-0 border-line-default bg-surface-primary text-content-secondary shadow-sm transition-colors hover:bg-surface-subtle hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:flex"
          >
            <ChevronRightIcon size={16} />
          </button>
        )}

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line-default bg-surface-primary shadow-xs">
          <div className="min-h-0 flex-1">{renderMainContent()}</div>
        </div>

        {isStageInfoOpen && (
          <aside
            className={`hidden min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-line-default bg-surface-primary font-sans select-none shadow-xs transition-all duration-200 lg:flex ${
              isStageInfoExpanded ? "w-[540px] max-w-[72vw]" : "w-[360px]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3 sm:px-4 sm:py-3.5">
              <h2 className="text-[11px] sm:text-xs font-bold tracking-widest text-content-heading uppercase">
                {formatStageLabel(activeStage)} STAGE
              </h2>
              <div className="flex items-center gap-1">
                <IconButton
                  aria-label={isStageInfoExpanded ? "Collapse stage info" : "Expand stage info"}
                  icon={<ExpandIcon size={13} />}
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 rounded-xl border-line-default/80"
                  onClick={handleExpandStageInfo}
                />
                <IconButton
                  aria-label="Close stage info"
                  icon={<CloseIcon size={13} />}
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 rounded-xl border-line-default/80"
                  onClick={() => setIsStageInfoOpen(false)}
                />
              </div>
            </div>
            {renderStageInfoPanel()}
          </aside>
        )}

        {!isStageInfoOpen && (
          <button
            type="button"
            aria-label="Open stage information panel"
            title="Open stage information panel"
            onClick={() => setIsStageInfoOpen(true)}
            className="absolute right-3 top-1/2 z-20 hidden h-12 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-l-xl border border-r-0 border-line-default bg-surface-primary text-content-secondary shadow-sm transition-colors hover:bg-surface-subtle hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:flex"
          >
            <ChevronLeftIcon size={16} />
          </button>
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
                className="relative z-10 w-72 h-full rounded-none shadow-2xl"
              />
            ) : (
              <aside className="relative z-10 h-full w-[92vw] max-w-[390px] bg-white ml-auto shadow-2xl flex flex-col">
                <div className="p-4 border-b border-line-subtle flex items-center justify-between">
                  <h2 className="text-xs font-bold tracking-wider text-content-secondary uppercase">
                    {formatStageLabel(activeStage)} Stage
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
