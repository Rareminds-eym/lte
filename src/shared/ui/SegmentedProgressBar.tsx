import type React from "react";
import { cn } from "@/shared/lib";

export interface SegmentedProgressBarProps {
  currentLevel: number;
  totalLevels: number;
  barColor?: string;
  emptyColor?: string;
  heightClassName?: string;
  gapClassName?: string;
  className?: string;
  ariaLabel?: string;
}

export const SegmentedProgressBar: React.FC<SegmentedProgressBarProps> = ({
  currentLevel,
  totalLevels,
  barColor = "bg-brand-600",
  emptyColor = "bg-line-default",
  heightClassName = "h-1.5",
  gapClassName = "gap-1",
  className,
  ariaLabel,
}) => {
  const safeTotal = Math.max(0, totalLevels);
  const safeCurrent = Math.max(0, Math.min(currentLevel, safeTotal));
  const visualTotal = Math.max(1, safeTotal);

  return (
    <div
      className={cn("flex", gapClassName, className)}
      role="progressbar"
      aria-valuenow={safeCurrent}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-label={ariaLabel ?? `Progress: Level ${safeCurrent} of ${safeTotal}`}
    >
      {Array.from({ length: visualTotal }, (_, idx) => {
        const isFilled = idx < safeCurrent;
        return (
          <div
            key={idx}
            className={cn(
              "flex-1 rounded-full transition-colors",
              heightClassName,
              isFilled ? barColor : emptyColor,
            )}
          />
        );
      })}
    </div>
  );
};
