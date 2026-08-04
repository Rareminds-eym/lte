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
