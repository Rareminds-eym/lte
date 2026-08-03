export const LTE_STAGE_SEQUENCE = [
  "engage",
  "explore",
  "explain",
  "express",
  "empower",
  "evolve",
] as const;

export type LteStageName = (typeof LTE_STAGE_SEQUENCE)[number];

const normalizeStageName = (stageName: string) => stageName.toLowerCase() as LteStageName;

export class StageSequenceError extends Error {
  code = "STAGE_SEQUENCE_LOCKED" as const;
}

export function assertStageSequenceAllowed(stageName: string, completedStages: string[]) {
  const normalizedStageName = normalizeStageName(stageName);
  const targetStageIndex = LTE_STAGE_SEQUENCE.indexOf(normalizedStageName);

  if (targetStageIndex === -1) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }

  const completedStageSet = new Set(completedStages.map(normalizeStageName));
  if (completedStageSet.has(normalizedStageName)) return;

  const firstIncompleteStageIndex = LTE_STAGE_SEQUENCE.findIndex(
    (stage) => !completedStageSet.has(stage),
  );

  if (firstIncompleteStageIndex === -1 || targetStageIndex <= firstIncompleteStageIndex) return;

  const requiredStage = LTE_STAGE_SEQUENCE[firstIncompleteStageIndex];
  throw new StageSequenceError(
    `Complete ${requiredStage} stage before accessing ${normalizedStageName}`,
  );
}
