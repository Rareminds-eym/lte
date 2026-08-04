export const LTE_STAGE_SEQUENCE = [
  "engage",
  "explore",
  "explain",
  "express",
  "empower",
  "evolve",
] as const;

export type LteStageName = (typeof LTE_STAGE_SEQUENCE)[number];
export type LteStage = LteStageName;

export const LTE_STAGE_COUNT = LTE_STAGE_SEQUENCE.length;

export const normalizeLteStageName = (stageName: string): LteStageName => {
  const normalizedStageName = stageName.toLowerCase();
  const validatedStageName = LTE_STAGE_SEQUENCE.find((stage) => stage === normalizedStageName);
  if (!validatedStageName) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }
  return validatedStageName;
};

export const isLteStageName = (stageName: string | undefined): stageName is LteStageName =>
  Boolean(stageName && (LTE_STAGE_SEQUENCE as readonly string[]).includes(stageName));

export const formatLteStageLabel = (stage: LteStageName) =>
  stage.charAt(0).toUpperCase() + stage.slice(1);
