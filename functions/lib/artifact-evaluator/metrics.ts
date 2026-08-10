/**
 * Lightweight in-memory metrics aggregator (Phase 3 observability).
 *
 * Counters are bumped at event sites; latencies are observed as histograms.
 * `logMetricsSnapshot` logs a single structured line with per-isolate
 * cumulative counts + histogram summaries since the last snapshot, then
 * resets. No PII is ever collected — keys are metric names only.
 *
 * ponytail: per-isolate memory only, no external sink. If cross-isolate
 * dashboards are ever needed, the upgrade is a queue/analytics write of the
 * snapshot; the emission points stay identical.
 */
import { apiLogger } from "../../shared/logger";
import { percentile } from "./drift-stats";

export const METRIC = {
  SUBMISSION_RECEIVED: "submission_received",
  VALIDATION_FAILED: "validation_failed",
  EXTRACTION_FAILED: "extraction_failed",
  HUMAN_REVIEW: "human_review",
  FALLBACK_USED: "fallback_used",
  EVALUATION_DURATION: "evaluation_duration",
  OPENROUTER_LATENCY: "openrouter_latency",
  RETRY_COUNT: "retry_count",
  SCHEMA_VALIDATION_FAILURES: "schema_validation_failures",
  DECISION_OVERRIDES: "decision_overrides",
  EVIDENCE_VALIDATION_FAILURES: "evidence_validation_failures",
  RATE_LIMIT_HITS: "rate_limit_hits",
} as const;

export type MetricName = (typeof METRIC)[keyof typeof METRIC];

const HISTOGRAM_CAP = 1024;

export interface HistogramSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramSummary>;
}

export function summarizeHistogram(values: number[]): HistogramSummary {
  if (values.length === 0) {
    return { count: 0, sum: 0, min: 0, max: 0, p50: 0, p95: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  return {
    count: values.length,
    sum,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}

export class Metrics {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  observe(name: string, value: number): void {
    const bucket = this.histograms.get(name) ?? [];
    if (bucket.length >= HISTOGRAM_CAP) bucket.shift();
    bucket.push(value);
    this.histograms.set(name, bucket);
  }

  snapshot(): MetricsSnapshot {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        Array.from(this.histograms, ([k, v]) => [k, summarizeHistogram(v)]),
      ),
    };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

export const metrics = new Metrics();

/**
 * Logs the current snapshot as one structured line and resets. Empty
 * snapshots are not logged to avoid log spam on every request.
 */
export function logMetricsSnapshot(context: Record<string, unknown> = {}): void {
  const snapshot = metrics.snapshot();
  if (
    Object.keys(snapshot.counters).length === 0 &&
    Object.keys(snapshot.histograms).length === 0
  ) {
    return;
  }
  apiLogger.info("metrics snapshot", { type: "metrics", ...context, ...snapshot });
  metrics.reset();
}
