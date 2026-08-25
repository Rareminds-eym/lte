import type React from "react";
import type { LteStage } from "@/entities/course";
import type { IconProps } from "@/shared/ui";

export interface StageStepInfo {
  id: LteStage;
  label: string;
  subtitle: string;
  icon: React.FC<IconProps>;
}

export interface StageStepperBarProps {
  activeStage?: LteStage;
  completedStages?: LteStage[];
  stageOverrides?: Partial<Record<LteStage, Pick<StageStepInfo, "subtitle" | "icon">>>;
  isStageDisabled?: (stage: LteStage) => boolean;
  onStageSelect?: (stage: LteStage) => void;
  className?: string;
}
