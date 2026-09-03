import type React from "react";
import { Button, CloseIcon, LockIcon } from "@/shared/ui";

export interface ModuleItem {
  id: string;
  moduleNo: number;
  title: string;
  progressPercentage?: number;
  isCompleted?: boolean;
  stageProgressDots?: Array<"blue" | "green" | "purple" | "gray">;
}

export interface ModulesDrawerProps {
  modules?: ModuleItem[];
  activeModuleNo?: number;
  onSelectModule?: (moduleNo: number) => void;
  onClose?: () => void;
  className?: string;
}

const DOT_COLOR_MAP: Record<string, string> = {
  blue: "bg-brand-600",
  green: "bg-success-600",
  purple: "bg-accent-purple-600",
  gray: "bg-surface-muted",
};

const clampProgress = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 100);
};

const getModuleDots = (
  dots: ModuleItem["stageProgressDots"] | undefined,
  progressPercentage: number,
) => {
  if (dots?.length) return dots;

  const completedDotCount = Math.floor((progressPercentage / 100) * 6);
  return Array.from({ length: 6 }, (_, index) =>
    index < completedDotCount ? "green" : "gray",
  ) satisfies ModuleItem["stageProgressDots"];
};

const getProgressColor = (progressPercentage: number, isActive: boolean) => {
  if (progressPercentage >= 100) return "bg-success-600";
  if (progressPercentage > 0 || isActive) return "bg-brand-600";
  return "bg-surface-muted";
};

export const ModulesDrawer: React.FC<ModulesDrawerProps> = ({
  modules = [],
  activeModuleNo = 1,
  onSelectModule,
  onClose,
  className = "",
}) => {
  return (
    <aside
      className={`w-[260px] max-w-[260px] bg-surface-primary border border-line-default rounded-2xl flex flex-col h-full shrink-0 overflow-hidden font-sans select-none shadow-xs transition-all duration-200 ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 sm:px-4 sm:py-3.5 flex items-center justify-between border-b border-line-subtle">
        <h2 className="text-[11px] sm:text-xs font-bold tracking-widest text-content-heading uppercase">
          MODULES
        </h2>
        {onClose && (
          <Button
            type="button"
            onClick={onClose}
            aria-label="Close Modules"
            icon={<CloseIcon size={14} />}
            variant="icon"
            size="sm"
            className="h-7 w-7 rounded-xl border border-line-default bg-surface-primary text-content-secondary shadow-2xs hover:bg-surface-subtle hover:text-content-primary flex items-center justify-center"
          />
        )}
      </div>

      {/* Modules List */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden p-3">
        {modules.length === 0 && (
          <p className="px-2 py-3 text-xs leading-relaxed text-content-secondary">
            No modules available for this course.
          </p>
        )}

        {modules.map((module, index) => {
          const isActive = module.moduleNo === activeModuleNo;
          const progressPercentage = clampProgress(module.progressPercentage);
          const dots = getModuleDots(module.stageProgressDots, progressPercentage);
          const progressColor = getProgressColor(progressPercentage, isActive);

          const isPrevCompleted =
            index > 0 &&
            (modules[index - 1]?.isCompleted ||
              (modules[index - 1]?.progressPercentage ?? 0) >= 100);
          const isLocked = index > 0 && !isPrevCompleted;

          if (isLocked) {
            return (
              <Button
                key={module.id}
                type="button"
                variant="ghost"
                size="sm"
                disabled
                className="w-full min-w-0 justify-start overflow-hidden border border-transparent bg-transparent p-2.5 text-left font-sans rounded-2xl opacity-50 cursor-not-allowed"
              >
                <div className="flex w-full min-w-0 items-start gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-default bg-surface-muted text-content-secondary">
                    <LockIcon size={12} className="text-content-muted" />
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden pb-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <h3 className="min-w-0 truncate text-xs font-semibold text-content-muted sm:text-[13px]">
                        {module.title}
                      </h3>
                      <span className="shrink-0 text-[11px] font-medium text-content-muted sm:text-xs">
                        0%
                      </span>
                    </div>

                    <div className="mt-1.5 h-1 rounded-full bg-surface-emphasis">
                      <div
                        className="h-full rounded-full bg-surface-muted"
                        style={{ width: "0%" }}
                      />
                    </div>
                  </div>
                </div>
              </Button>
            );
          }

          if (isActive) {
            return (
              <Button
                key={module.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelectModule?.(module.moduleNo)}
                className="w-full min-w-0 justify-start overflow-hidden border border-brand-200 bg-brand-50 p-2.5 text-left font-sans sm:p-3 rounded-2xl transition-all duration-150 shadow-2xs"
              >
                <div className="flex w-full min-w-0 items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full ${progressColor} text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}
                    >
                      {module.moduleNo}
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <h3 className="min-w-0 truncate text-xs font-bold leading-tight text-content-primary sm:text-[13px]">
                          {module.title}
                        </h3>
                        <span className="shrink-0 text-[11px] font-bold text-brand-600 sm:text-xs">
                          {progressPercentage}%
                        </span>
                      </div>

                      <div className="mt-1.5 h-1 rounded-full bg-surface-emphasis">
                        <div
                          className={`h-full rounded-full ${progressColor}`}
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center gap-1">
                        {dots.map((dotColor, idx) => (
                          <span
                            key={`${module.id}-${dotColor}-${idx}`}
                            className={`h-2 w-2 rounded-full ${
                              DOT_COLOR_MAP[dotColor] || "bg-surface-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Button>
            );
          }

          return (
            <Button
              key={module.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelectModule?.(module.moduleNo)}
              className="w-full min-w-0 justify-start overflow-hidden border border-transparent bg-transparent p-2.5 text-left font-sans rounded-2xl hover:bg-surface-subtle/80 transition-colors duration-150"
            >
              <div className="flex w-full min-w-0 items-start gap-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    progressPercentage > 0
                      ? `${progressColor} border-transparent text-white`
                      : "border-line-default/70 bg-surface-muted/90 text-content-secondary"
                  }`}
                >
                  {module.moduleNo}
                </span>
                <div className="min-w-0 flex-1 overflow-hidden pb-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-xs font-semibold text-content-body hover:text-content-primary sm:text-[13px]">
                      {module.title}
                    </h3>
                    <span className="shrink-0 text-[11px] font-medium text-content-muted sm:text-xs">
                      {progressPercentage}%
                    </span>
                  </div>

                  <div className="mt-1.5 h-1 rounded-full bg-surface-emphasis">
                    <div
                      className={`h-full rounded-full ${progressColor}`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </aside>
  );
};
