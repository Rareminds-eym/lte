import { Fragment } from "react";
import { Button, CheckIcon, LockIcon } from "@/shared/ui";
import { STAGE_STEPS } from "./constants";
import type { StageStepperBarProps } from "./types";

export const StageStepperBar: React.FC<StageStepperBarProps> = ({
  activeStage = "engage",
  completedStages = [],
  stageProgress = {},
  stageOverrides,
  isStageDisabled,
  onStageSelect,
  className = "",
}) => {
  return (
    <div
      className={`h-14 bg-surface-primary border-b border-line-subtle px-4 flex items-center shrink-0 select-none overflow-x-auto scrollbar-none relative ${className}`}
    >
      <div className="flex min-w-max items-center">
        {STAGE_STEPS.map((step, index) => {
          const isActive = step.id === activeStage;
          const isCompleted = completedStages.includes(step.id);
          const isDisabled = isStageDisabled?.(step.id) ?? false;
          const progressValue = Math.min(
            Math.max(isCompleted ? 100 : (stageProgress[step.id] ?? 0), 0),
            100,
          );
          const stepOverride = stageOverrides?.[step.id];
          const StepIcon = isDisabled ? LockIcon : (stepOverride?.icon ?? step.icon);
          const subtitle = stepOverride?.subtitle ?? step.subtitle;
          const iconClassName = isCompleted
            ? "text-success-600"
            : isDisabled
              ? "text-content-muted"
              : "text-content-muted group-hover:text-content-primary";

          return (
            <Fragment key={step.id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`${step.label} ${subtitle}${isDisabled ? " locked" : ""}`}
                disabled={isDisabled}
                onClick={() => onStageSelect?.(step.id)}
                className={`group relative h-14 min-w-44 rounded-none border-b-0 px-4 py-0 font-sans text-xs transition-colors hover:bg-surface-muted disabled:hover:bg-transparent ${
                  isActive
                    ? "text-brand-600 font-bold"
                    : isCompleted
                      ? "text-success-600 font-semibold"
                      : isDisabled
                        ? "text-content-muted font-medium"
                        : "text-content-muted font-medium hover:text-content-primary"
                }`}
              >
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {isActive ? (
                      <span
                        className="relative flex h-3.5 w-3.5 items-center justify-center"
                        aria-hidden="true"
                      >
                        <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-warning-500/50 motion-reduce:animate-none" />
                        <span className="relative h-2 w-2 rounded-full bg-warning-500" />
                      </span>
                    ) : isCompleted ? (
                      <CheckIcon size={13} className={iconClassName} />
                    ) : (
                      <StepIcon size={14} className={iconClassName} />
                    )}
                  </span>

                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={
                        isActive
                          ? "text-brand-600 font-bold"
                          : isCompleted
                            ? "text-success-600 font-semibold"
                            : isDisabled
                              ? "text-content-muted"
                              : "text-content-secondary group-hover:text-content-primary"
                      }
                    >
                      {step.label}
                    </span>
                    <span className="text-xs text-content-muted font-normal">{subtitle}</span>
                  </span>
                </span>

                {!isDisabled && (
                  <span
                    className="absolute bottom-2 left-3.5 right-3.5 h-1 rounded-full bg-line-default"
                    role="progressbar"
                    aria-label={`${step.label} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progressValue)}
                  >
                    <span
                      className="block h-full rounded-full bg-success-600 transition-[width] duration-300"
                      style={{ width: `${progressValue}%` }}
                    />
                  </span>
                )}
              </Button>

              {index < STAGE_STEPS.length - 1 && (
                <div
                  className={`-mx-1 h-px w-10 shrink-0 transition-colors ${
                    completedStages.includes(step.id) ? "bg-success-500" : "bg-line-default"
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
};
