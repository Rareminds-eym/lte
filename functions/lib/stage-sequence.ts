import { LTE_STAGE_COUNT, LTE_STAGE_SEQUENCE, type LteStageName } from "@/shared/types/lte-stages";

export { LTE_STAGE_COUNT, LTE_STAGE_SEQUENCE, type LteStageName } from "@/shared/types/lte-stages";

export const normalizeStageName = (stageName: string): LteStageName => {
  const normalizedStageName = stageName.toLowerCase();
  if (!LTE_STAGE_SEQUENCE.includes(normalizedStageName as LteStageName)) {
    throw new Error(`Invalid stage name: ${stageName}`);
  }
  return normalizedStageName as LteStageName;
};

export function getStageOrder(stageName: string) {
  const stageIndex = LTE_STAGE_SEQUENCE.indexOf(normalizeStageName(stageName));
  return stageIndex === -1 ? null : stageIndex + 1;
}

export function getStageCompletionPercentage(stagesCompleted: number) {
  return Math.round((stagesCompleted / LTE_STAGE_COUNT) * 100);
}

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
