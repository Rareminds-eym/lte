import type React from "react";
import { SegmentedProgressBar } from "@/shared/ui";
import { DurationIcon, EnergyBoltIcon } from "@/shared/ui/icons";

export interface CourseStatsOverlayProps {
  totalDuration: string;
  xpAvailable: string;
  completedLevels: number;
  totalLevels: number;
  targetLevel: string;
}

export const CourseStatsOverlay: React.FC<CourseStatsOverlayProps> = ({
  totalDuration,
  xpAvailable,
  completedLevels,
  totalLevels,
  targetLevel,
}) => {
  return (
    <div className="relative z-20 mx-3 sm:mx-6 md:mx-8 -mt-6 sm:-mt-8 rounded-2xl border border-border-default bg-surface-primary p-5 sm:p-6 shadow-xl shadow-slate-200/40">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-8">
        {/* Total Duration */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 shadow-sm">
            <DurationIcon size={20} />
          </div>
          <div>
            <p className="text-lg font-bold text-content-primary leading-snug">{totalDuration}</p>
            <p className="text-xs text-content-secondary">Total duration</p>
          </div>
        </div>

        <div className="hidden h-10 w-px bg-line-default md:block" />

        {/* XP Available */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-orange-50 text-accent-orange-500 shadow-sm">
            <EnergyBoltIcon size={20} />
          </div>
          <div>
            <p className="text-lg font-bold text-content-primary leading-snug">{xpAvailable}</p>
            <p className="text-xs text-content-secondary">Available</p>
          </div>
        </div>

        <div className="hidden h-10 w-px bg-line-default md:block" />

        {/* Progress Bar & Level Target */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between gap-2 mb-2 text-xs">
            <span className="font-semibold text-brand-600">
              Level {completedLevels} of {totalLevels} completed
            </span>
            <span className="font-bold uppercase tracking-wider text-content-secondary">
              TARGET: {targetLevel}
            </span>
          </div>

          {/* Segmented progress bar */}
          <SegmentedProgressBar
            currentLevel={completedLevels}
            totalLevels={totalLevels}
            heightClassName="h-2"
            gapClassName="gap-1.5"
            barColor="bg-brand-600"
            emptyColor="bg-line-default"
          />
        </div>
      </div>
    </div>
  );
};
