import { expect, it } from "vitest";
import { CertificateAlertMonitor, parseCertificateLog } from "../monitoring";

const now = Date.parse("2026-10-08T09:00:00Z");
it("counts the actual render-failure event but not unrelated cleanup or list failures", () => {
  const monitor = new CertificateAlertMonitor();
  monitor.ingest({ timestamp: now, event: "certificate.list_failed" }, now);
  monitor.ingest({ timestamp: now, event: "certificate.storage_cleanup_failed" }, now);
  expect(monitor.ingest({ timestamp: now, event: "certificate.render_failed" }, now)).toMatchObject(
    [{ rule: "render_failure_rate", state: "firing", count: 1, total: 1 }],
  );
});
it("fires each configured threshold, deduplicates, and resolves after fifteen minutes", () => {
  const monitor = new CertificateAlertMonitor();
  expect(
    monitor.ingest({ timestamp: now, event: "certificate.immutability_violation" }, now),
  ).toMatchObject([{ rule: "immutability_violation", state: "firing" }]);
  expect(
    monitor.ingest({ timestamp: now, event: "certificate.immutability_violation" }, now),
  ).toEqual([]);
  for (let i = 0; i < 10; i++)
    expect(monitor.ingest({ timestamp: now, event: "certificate.issue_failed" }, now)).toEqual([]);
  expect(monitor.ingest({ timestamp: now, event: "certificate.issue_failed" }, now)).toMatchObject([
    { rule: "issuance_failures", state: "firing" },
  ]);
  for (let i = 0; i < 19; i++)
    monitor.ingest({ timestamp: now, event: "certificate.render", outcome: "success" }, now);
  expect(
    monitor.ingest({ timestamp: now, event: "certificate.render", outcome: "failure" }, now),
  ).toEqual([]);
  expect(
    monitor.ingest({ timestamp: now, event: "certificate.render", outcome: "failure" }, now),
  ).toMatchObject([{ rule: "render_failure_rate", state: "firing" }]);
  expect(monitor.evaluate(now + 900_000)).toHaveLength(3);
  expect(monitor.evaluate(now + 900_001)).toEqual([]);
});
it("parses real logger lines without propagating PII, and ignores malformed or future logs", () => {
  const event = parseCertificateLog(
    '[2026-10-08T09:00:00Z] [ERROR] [certificates] certificate.render {"outcome":"failure","email":"secret@example.test","token":"secret"}',
  );
  expect(event).toEqual({ timestamp: now, event: "certificate.render", outcome: "failure" });
  for (const line of [
    "bad",
    "[bad] [ERROR] [certificates] certificate.render {}",
    "[2026-10-08T09:00:00Z] [ERROR] [certificates] certificate.render {bad}",
  ])
    expect(parseCertificateLog(line)).toBeNull();
  expect(
    new CertificateAlertMonitor().ingest(
      { timestamp: now + 1, event: "certificate.immutability_violation" },
      now,
    ),
  ).toEqual([]);
});
