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
