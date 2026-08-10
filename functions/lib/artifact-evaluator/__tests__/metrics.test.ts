import { describe, expect, it } from "vitest";
import { apiLogger } from "../../../shared/logger";
import { logMetricsSnapshot, METRIC, Metrics, metrics, summarizeHistogram } from "../metrics";

describe("Metrics", () => {
  it("counts increments", () => {
    const metrics = new Metrics();
    metrics.inc(METRIC.SUBMISSION_RECEIVED);
    metrics.inc(METRIC.SUBMISSION_RECEIVED);
    metrics.inc(METRIC.VALIDATION_FAILED);
    expect(metrics.snapshot().counters[METRIC.SUBMISSION_RECEIVED]).toBe(2);
    expect(metrics.snapshot().counters[METRIC.VALIDATION_FAILED]).toBe(1);
  });

  it("summarizes observed histograms", () => {
    const metrics = new Metrics();
    for (const v of [10, 20, 30, 40, 100]) metrics.observe(METRIC.EVALUATION_DURATION, v);
    const summary = metrics.snapshot().histograms[METRIC.EVALUATION_DURATION]!;
    expect(summary.count).toBe(5);
    expect(summary.min).toBe(10);
    expect(summary.max).toBe(100);
    expect(summary.sum).toBe(200);
    expect(summary.p50).toBe(30);
    expect(summary.p95).toBe(100);
  });

  it("caps histogram buckets", () => {
    const metrics = new Metrics();
    for (let i = 0; i < 2_000; i += 1) metrics.observe("x", i);
    expect(metrics.snapshot().histograms["x"]?.count).toBe(1024);
  });

  it("reset clears everything", () => {
    const metrics = new Metrics();
    metrics.inc("a");
    metrics.observe("b", 1);
    metrics.reset();
    expect(metrics.snapshot().counters["a"]).toBeUndefined();
    expect(metrics.snapshot().histograms["b"]).toBeUndefined();
  });
});

describe("summarizeHistogram", () => {
  it("returns zeros for empty input", () => {
    expect(summarizeHistogram([])).toEqual({ count: 0, sum: 0, min: 0, max: 0, p50: 0, p95: 0 });
  });
});

describe("logMetricsSnapshot", () => {
  it("skips logging when nothing was recorded", () => {
    const spy = vi.spyOn(apiLogger, "info");
    logMetricsSnapshot({ endpoint: "test" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs and resets the snapshot", () => {
    const spy = vi.spyOn(apiLogger, "info");
    metrics.inc("submission_received");
    logMetricsSnapshot({ endpoint: "test" });
    expect(spy).toHaveBeenCalledWith(
      "metrics snapshot",
      expect.objectContaining({ type: "metrics" }),
    );
    expect(metrics.snapshot().counters["submission_received"]).toBeUndefined();
    spy.mockRestore();
  });
});
