import { describe, expect, it } from "vitest";
import { computeDriftStats, percentile } from "../drift-stats";

const stored = [
  { decision: "pass", score: 90, confidence: 0.8 },
  { decision: "pass", score: 70, confidence: 0.6 },
  { decision: "fail", score: 30, confidence: 0.9 },
];

describe("percentile", () => {
  it("returns nearest-rank percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 95)).toBe(5);
  });

  it("returns 0 for empty input", () => {
    expect(percentile([], 50)).toBe(0);
  });
});

describe("computeDriftStats", () => {
  it("reports zero drift for identical observations", () => {
    const stats = computeDriftStats(stored, stored);
    expect(stats.comparisons).toBe(3);
    expect(stats.decisionFlipRate).toBe(0);
    expect(stats.avgScoreDelta).toBe(0);
    expect(stats.p50ScoreDelta).toBe(0);
    expect(stats.avgConfidenceDelta).toBe(0);
  });

  it("quantifies flips and deltas", () => {
    const replayed = [
      { decision: "pass", score: 88, confidence: 0.75 },
      { decision: "fail", score: 55, confidence: 0.7 },
      { decision: "fail", score: 30, confidence: 0.9 },
    ];
    const stats = computeDriftStats(stored, replayed);
    expect(stats.comparisons).toBe(3);
    expect(stats.decisionFlipRate).toBe(1 / 3);
    expect(stats.avgScoreDelta).toBeCloseTo((2 + 15 + 0) / 3, 5);
    expect(stats.avgConfidenceDelta).toBeCloseTo((0.05 + 0.1 + 0) / 3, 5);
    expect(stats.p50ScoreDelta).toBe(2);
    expect(stats.p95ScoreDelta).toBe(15);
  });

  it("throws on length mismatch", () => {
    expect(() => computeDriftStats(stored, stored.slice(1))).toThrow(/observations/);
  });
});
