import type React from "react";
import type { LevelDetailsResponse } from "@/entities/course";
import type { LteStage } from "@/shared/constants/lte-stages";
import { CloseIcon, ExpandIcon, IconButton, Skeleton, SkeletonGroup } from "@/shared/ui";
import { LevelHeader, type ModuleItem, ModulesDrawer, StageStepperBar } from "@/widgets";

interface ModuleLoadingShellProps {
  level: LevelDetailsResponse;
  moduleNumber: number;
  activeStage: LteStage;
  completedStages: LteStage[];
  isModulesOpen: boolean;
  isStageInfoOpen: boolean;
  onBackToOverview: () => void;
  onToggleModules: () => void;
  onToggleStageInfo: () => void;
  onSelectModule: (moduleNo: number) => void;
  onCloseModules: () => void;
}

export const ModuleLoadingShell: React.FC<ModuleLoadingShellProps> = ({
  level,
  moduleNumber,
  activeStage,
  completedStages,
  isModulesOpen,
  isStageInfoOpen,
  onBackToOverview,
  onToggleModules,
  onToggleStageInfo,
  onSelectModule,
  onCloseModules,
}) => {
  const activeModuleSummary = level.modules.find((module) => module.moduleNo === moduleNumber);
  const moduleDrawerItems: ModuleItem[] = level.modules.map((module) => ({
    id: module.id,
    moduleNo: module.moduleNo,
    title: module.title,
    progressPercentage: module.progressPercentage ?? 0,
    isCompleted: module.progressPercentage === 100 || module.isCompleted || false,
  }));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-secondary">
      <LevelHeader
        levelTitle={activeModuleSummary?.title ?? level.title}
        activeStage={activeStage}
        isModulesOpen={isModulesOpen}
        isStageInfoOpen={isStageInfoOpen}
        onBackClick={onBackToOverview}
        onOverviewClick={onBackToOverview}
        onToggleModules={onToggleModules}
        onToggleStageInfo={onToggleStageInfo}
      />

      <StageStepperBar
        activeStage={activeStage}
        completedStages={completedStages}
        isStageDisabled={() => true}
        onStageSelect={() => undefined}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {isModulesOpen && (
          <ModulesDrawer
            activeModuleNo={moduleNumber}
            modules={moduleDrawerItems}
            onSelectModule={onSelectModule}
            onClose={onCloseModules}
            className="hidden lg:flex"
          />
        )}

        <SkeletonGroup
          className="flex min-h-0 min-w-0 flex-1 flex-col bg-white"
          aria-label="Loading module content"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-subtle px-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-muted p-6">
            <Skeleton className="h-3/5 w-4/5 rounded-xl" />
          </div>
          <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-line-default bg-surface-primary px-4">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-2 w-36 rounded-full" />
            <Skeleton className="h-9 w-28 justify-self-end rounded-lg bg-brand-100" />
          </div>
        </SkeletonGroup>

        {isStageInfoOpen && (
          <aside className="hidden min-h-0 w-[340px] shrink-0 flex-col overflow-hidden border-l border-border-default/80 bg-white font-sans select-none lg:flex">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5">
              <h2 className="text-xs font-bold tracking-widest text-content-heading uppercase">
                Stage Info
              </h2>
              <div className="flex items-center gap-1">
                <IconButton
                  aria-label="Expand stage info"
                  icon={<ExpandIcon size={13} />}
                  size="sm"
                  variant="outline"
                  disabled
                />
                <IconButton
                  aria-label="Close stage info"
                  icon={<CloseIcon size={13} />}
                  size="sm"
                  variant="outline"
                  onClick={onToggleStageInfo}
                />
              </div>
            </div>
            <SkeletonGroup className="space-y-4 p-4" aria-label="Loading stage info">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl bg-brand-50" />
            </SkeletonGroup>
          </aside>
        )}
      </div>
    </div>
  );
};
