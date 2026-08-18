import { Fragment } from "react";
import { Button, CheckIcon, LockIcon } from "@/shared/ui";
import { STAGE_STEPS } from "./constants";
import type { StageStepperBarProps } from "./types";

export const StageStepperBar: React.FC<StageStepperBarProps> = ({
  activeStage = "engage",
  completedStages = [],
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
          const stepOverride = stageOverrides?.[step.id];
          const StepIcon = isDisabled ? LockIcon : (stepOverride?.icon ?? step.icon);
          const subtitle = stepOverride?.subtitle ?? step.subtitle;
          const iconClassName = isCompleted
            ? "text-success-600"
            : isActive
              ? "text-brand-600"
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
                className={`group h-14 rounded-none border-b-2 px-3.5 py-0 font-sans text-xs transition-colors hover:bg-surface-muted disabled:hover:bg-transparent ${
                  isCompleted
                    ? `text-success-600 ${isActive ? "border-success-500 font-bold" : "border-transparent font-semibold"}`
                    : isActive
                      ? "border-brand-600 text-brand-600 font-bold"
                      : isDisabled
                        ? "border-transparent text-content-muted font-medium"
                        : "border-transparent text-content-muted font-medium hover:text-content-primary"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {isCompleted ? (
                    <CheckIcon size={13} className={iconClassName} />
                  ) : (
                    <StepIcon size={14} className={iconClassName} />
                  )}
                </span>

                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span
                    className={
                      isCompleted
                        ? `text-success-600 ${isActive ? "font-bold" : "font-semibold"}`
                        : isActive
                          ? "text-brand-600 font-bold"
                          : isDisabled
                            ? "text-content-muted"
                            : "text-content-secondary group-hover:text-content-primary"
                    }
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-content-muted font-normal">{subtitle}</span>
                </div>
              </Button>

              {index < STAGE_STEPS.length - 1 && (
                <div
                  className={`-mx-2 h-px w-7 shrink-0 transition-colors ${
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
