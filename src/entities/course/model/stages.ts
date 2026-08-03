export const LTE_STAGE_SEQUENCE = [
  "engage",
  "explore",
  "explain",
  "express",
  "empower",
  "evolve",
] as const;

export type LteStageName = (typeof LTE_STAGE_SEQUENCE)[number];

export const LTE_STAGE_COUNT = LTE_STAGE_SEQUENCE.length;

export const normalizeLteStageName = (stageName: string): LteStageName => {
  const normalizedStageName = stageName.toLowerCase() as LteStageName;
  if (!LTE_STAGE_SEQUENCE.includes(normalizedStageName)) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }
  return normalizedStageName;
};

export const isLteStageName = (stageName: string | undefined): stageName is LteStageName =>
  Boolean(stageName && LTE_STAGE_SEQUENCE.includes(stageName.toLowerCase() as LteStageName));

export const formatLteStageLabel = (stage: LteStageName) =>
  stage.charAt(0).toUpperCase() + stage.slice(1);
