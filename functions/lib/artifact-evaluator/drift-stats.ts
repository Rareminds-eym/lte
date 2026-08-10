/**
 * Drift statistics for the deterministic evaluation replay tool (Phase 3).
 *
 * Pure functions: given a stored evaluation and its replayed counterpart,
 * quantify how far the model's behaviour has drifted. Used by
 * scripts/eval-replay.ts; unit-tested in isolation.
 */

export interface EvalObservation {
  decision: string;
  score: number;
  confidence: number;
}

export interface DriftStats {
  comparisons: number;
  decisionFlipRate: number;
  avgScoreDelta: number;
  p50ScoreDelta: number;
  p95ScoreDelta: number;
  avgConfidenceDelta: number;
  p50ConfidenceDelta: number;
  p95ConfidenceDelta: number;
}

/** Nearest-rank percentile on a sorted ascending array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

/**
 * Compares two equal-length observation sets (same prompts, same order).
 * Decision flip rate is the fraction of comparisons whose decision differs;
 * score/confidence deltas are absolute differences.
 */
export function computeDriftStats(
  stored: EvalObservation[],
  replayed: EvalObservation[],
): DriftStats {
  if (stored.length !== replayed.length) {
    throw new Error(
      `Cannot compute drift: stored ${stored.length} observations, replayed ${replayed.length}.`,
    );
  }

  const scoreDeltas: number[] = [];
  const confidenceDeltas: number[] = [];
  let flips = 0;

  for (let i = 0; i < stored.length; i += 1) {
    const a = stored[i] as (typeof stored)[number];
    const b = replayed[i] as (typeof replayed)[number];
    scoreDeltas.push(Math.abs(a.score - b.score));
    confidenceDeltas.push(Math.abs(a.confidence - b.confidence));
    if (a.decision !== b.decision) flips += 1;
  }

  scoreDeltas.sort((x, y) => x - y);
  confidenceDeltas.sort((x, y) => x - y);

  return {
    comparisons: stored.length,
    decisionFlipRate: stored.length === 0 ? 0 : flips / stored.length,
    avgScoreDelta: average(scoreDeltas),
    p50ScoreDelta: percentile(scoreDeltas, 50),
    p95ScoreDelta: percentile(scoreDeltas, 95),
    avgConfidenceDelta: average(confidenceDeltas),
    p50ConfidenceDelta: percentile(confidenceDeltas, 50),
    p95ConfidenceDelta: percentile(confidenceDeltas, 95),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}
