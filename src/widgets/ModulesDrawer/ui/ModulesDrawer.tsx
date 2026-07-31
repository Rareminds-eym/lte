import type React from "react";
import { Button, CloseIcon } from "@/shared/ui";

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
  blue: "bg-blue-600",
  green: "bg-emerald-500",
  purple: "bg-purple-300",
  gray: "bg-gray-300",
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
  if (progressPercentage >= 100) return "bg-emerald-500";
  if (progressPercentage > 0 || isActive) return "bg-blue-600";
  return "bg-slate-300";
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
      className={`w-[256px] max-w-[256px] bg-white border-r border-slate-200/80 flex flex-col h-full shrink-0 overflow-hidden font-sans select-none transition-all duration-200 ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 sm:px-4 sm:py-3.5 flex items-center justify-between border-b border-slate-100">
        <h2 className="text-[11px] sm:text-xs font-bold tracking-widest text-slate-800 uppercase">
          MODULES
        </h2>
        {onClose && (
          <Button
            type="button"
            onClick={onClose}
            aria-label="Close Modules"
            icon={<CloseIcon size={15} />}
            variant="icon"
            size="sm"
            className="h-8 w-8 rounded-xl border-slate-200/80 bg-white text-slate-500 shadow-2xs hover:bg-slate-50 hover:text-slate-700"
          />
        )}
      </div>

      {/* Modules List */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden p-2.5 sm:space-y-2 sm:p-3">
        {modules.length === 0 && (
          <p className="px-2 py-3 text-xs leading-relaxed text-slate-500">
            No modules available for this course.
          </p>
        )}

        {modules.map((module) => {
          const isActive = module.moduleNo === activeModuleNo;
          const progressPercentage = clampProgress(module.progressPercentage);
          const dots = getModuleDots(module.stageProgressDots, progressPercentage);
          const progressColor = getProgressColor(progressPercentage, isActive);

          if (isActive) {
            return (
              <Button
                key={module.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelectModule?.(module.moduleNo)}
                className="w-full min-w-0 justify-start overflow-hidden border border-blue-100/50 bg-brand-50 p-2.5 text-left font-sans sm:p-3 rounded-xl transition-all duration-150 shadow-2xs"
              >
                <div className="flex w-full min-w-0 items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span
                      className={`w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full ${progressColor} text-white font-bold text-[11px] sm:text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}
                    >
                      {module.moduleNo}
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <h3 className="min-w-0 truncate text-xs font-bold leading-tight text-slate-900 sm:text-[13px]">
                          {module.title}
                        </h3>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-400 sm:text-xs">
                          {progressPercentage}%
                        </span>
                      </div>

                      <div className="mt-1.5 h-1 rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${progressColor}`}
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>

                      <div className="mt-2 flex items-center gap-1">
                        {dots.map((dotColor, idx) => (
                          <span
                            key={`${module.id}-${dotColor}-${idx}`}
                            className={`h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${
                              DOT_COLOR_MAP[dotColor] || "bg-gray-300"
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
              className="w-full min-w-0 justify-start overflow-hidden border border-transparent bg-transparent p-2 text-left font-sans sm:p-2.5 rounded-lg hover:bg-slate-50/80 transition-colors duration-150"
            >
              <div className="flex w-full min-w-0 items-start gap-2.5">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold sm:h-6.5 sm:w-6.5 sm:text-xs ${
                    progressPercentage > 0
                      ? `${progressColor} border-transparent text-white`
                      : "border-slate-200/70 bg-slate-100/90 text-slate-500"
                  }`}
                >
                  {module.moduleNo}
                </span>
                <div className="min-w-0 flex-1 overflow-hidden pb-1.5">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-xs font-semibold text-slate-700 hover:text-slate-900 sm:text-[13px]">
                      {module.title}
                    </h3>
                    <span className="shrink-0 text-[11px] font-medium text-slate-400 sm:text-xs">
                      {progressPercentage}%
                    </span>
                  </div>

                  <div className="mt-1.5 h-1 rounded-full bg-slate-200">
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
