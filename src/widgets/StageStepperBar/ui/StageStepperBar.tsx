import type React from "react";
import { Fragment } from "react";
import {
  BeakerIcon,
  Button,
  CheckIcon,
  CodeBracketsIcon,
  type IconProps,
  LayerStackIcon,
  LightbulbIcon,
  LightningBoltIcon,
  TrendingArrowIcon,
} from "@/shared/ui";
import type { LteStage } from "@/widgets/LevelHeader";

export interface StageStepInfo {
  id: LteStage;
  label: string;
  subtitle: string;
  icon: React.FC<IconProps>;
}

export const STAGE_STEPS: StageStepInfo[] = [
  { id: "engage", label: "Engage", subtitle: "Hook & Context", icon: LightbulbIcon },
  { id: "explore", label: "Explore", subtitle: "Investigate", icon: BeakerIcon },
  { id: "explain", label: "Explain", subtitle: "Learn Concepts", icon: LayerStackIcon },
  { id: "express", label: "Express", subtitle: "Practice", icon: CodeBracketsIcon },
  { id: "empower", label: "Empower", subtitle: "Apply", icon: LightningBoltIcon },
  { id: "evolve", label: "Evolve", subtitle: "Reflect & Grow", icon: TrendingArrowIcon },
];

export interface StageStepperBarProps {
  activeStage?: LteStage;
  completedStages?: LteStage[];
  stageOverrides?: Partial<Record<LteStage, Pick<StageStepInfo, "subtitle" | "icon">>>;
  onStageSelect?: (stage: LteStage) => void;
  className?: string;
}

export const StageStepperBar: React.FC<StageStepperBarProps> = ({
  activeStage = "engage",
  completedStages = [],
  stageOverrides,
  onStageSelect,
  className = "",
}) => {
  const activeIndex = STAGE_STEPS.findIndex((s) => s.id === activeStage);

  return (
    <div
      className={`h-14 bg-surface-primary border-b border-line-subtle px-4 flex items-center shrink-0 select-none overflow-x-auto scrollbar-none relative ${className}`}
    >
      <div className="flex min-w-max items-center">
        {STAGE_STEPS.map((step, index) => {
          const isActive = step.id === activeStage;
          const isCompleted = completedStages.includes(step.id) || index < activeIndex;
          const stepOverride = stageOverrides?.[step.id];
          const StepIcon = stepOverride?.icon ?? step.icon;
          const subtitle = stepOverride?.subtitle ?? step.subtitle;

          return (
            <Fragment key={step.id}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`${step.label} ${subtitle}`}
                onClick={() => onStageSelect?.(step.id)}
                className={`group h-14 rounded-none border-b-2 px-3.5 py-0 font-sans text-xs transition-colors hover:bg-surface-muted ${
                  isActive
                    ? "border-brand-600 text-brand-600 font-bold"
                    : isCompleted
                      ? "border-transparent text-success-600 font-semibold"
                      : "border-transparent text-content-muted font-medium hover:text-content-primary"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {isCompleted ? <CheckIcon size={13} /> : <StepIcon size={14} />}
                </span>

                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span
                    className={
                      isActive
                        ? "text-brand-600 font-bold"
                        : isCompleted
                          ? "text-success-600 font-semibold"
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
                    index < activeIndex ? "bg-success-500" : "bg-line-default"
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
