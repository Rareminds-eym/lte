import {
  BeakerIcon,
  CodeBracketsIcon,
  LayerStackIcon,
  LightbulbIcon,
  LightningBoltIcon,
  TrendingArrowIcon,
} from "@/shared/ui";
import type { StageStepInfo } from "./types";

export const STAGE_STEPS: StageStepInfo[] = [
  { id: "engage", label: "Engage", subtitle: "Hook & Context", icon: LightbulbIcon },
  { id: "explore", label: "Explore", subtitle: "Investigate", icon: BeakerIcon },
  { id: "explain", label: "Explain", subtitle: "Learn Concepts", icon: LayerStackIcon },
  { id: "express", label: "Express", subtitle: "Practice", icon: CodeBracketsIcon },
  { id: "empower", label: "Empower", subtitle: "Apply", icon: LightningBoltIcon },
  { id: "evolve", label: "Evolve", subtitle: "Reflect & Grow", icon: TrendingArrowIcon },
];
