import { LTE_STAGE_SEQUENCE, type LteStageName } from "@/shared/types/lte-stages";

export { LTE_STAGE_COUNT, LTE_STAGE_SEQUENCE, type LteStageName } from "@/shared/types/lte-stages";

export const normalizeLteStageName = (stageName: string): LteStageName => {
  const normalizedStageName = stageName.toLowerCase();
  if (!LTE_STAGE_SEQUENCE.includes(normalizedStageName as LteStageName)) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }
  return normalizedStageName as LteStageName;
};

export const isLteStageName = (stageName: string | undefined): stageName is LteStageName =>
  Boolean(stageName && (LTE_STAGE_SEQUENCE as readonly string[]).includes(stageName));

export const formatLteStageLabel = (stage: LteStageName) =>
  stage.charAt(0).toUpperCase() + stage.slice(1);
