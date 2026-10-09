import rules from "@ops/certificates/alerts.json";
export interface CertificateLogEvent {
  timestamp: number;
  event: string;
  outcome?: string;
}
export interface CertificateAlert {
  rule: "render_failure_rate" | "issuance_failures" | "immutability_violation";
  state: "firing" | "resolved";
  timestamp: string;
  count: number;
  total?: number;
}
/** Read only the event/outcome from the logger; never forward arbitrary metadata to alerts. */
export function parseCertificateLog(line: string): CertificateLogEvent | null {
  const match = line.match(
    /^\[([^\]]+)\] \[(?:INFO|WARN|ERROR)\] \[certificates\] (certificate\.[a-z_]+) (\{.*\})$/,
  );
  if (!match) return null;
  const timestamp = Date.parse(match[1] ?? "");
  if (!Number.isFinite(timestamp)) return null;
  try {
    const fields: unknown = JSON.parse(match[3] ?? "{}");
    const outcome =
      fields &&
      typeof fields === "object" &&
      "outcome" in fields &&
      typeof fields.outcome === "string"
        ? fields.outcome
        : undefined;
    return { timestamp, event: match[2] ?? "", outcome };
  } catch {
    return null;
  }
}
export class CertificateAlertMonitor {
  private events: CertificateLogEvent[] = [];
  private active = new Set<CertificateAlert["rule"]>();
  ingest(event: CertificateLogEvent, now = Date.now()): CertificateAlert[] {
    if (event.timestamp <= now) this.events.push(event);
    return this.evaluate(now);
  }
  evaluate(now = Date.now()): CertificateAlert[] {
    this.events = this.events.filter(
      (event) => event.timestamp > now - rules.windowSeconds * 1000 && event.timestamp <= now,
    );
    const renders = this.events.filter(
      (event) =>
        event.event === "certificate.render" || event.event === "certificate.render_failed",
    );
    const failures = renders.filter(
      (event) => event.outcome === "failure" || event.event === "certificate.render_failed",
    ).length;
    const issuance = this.events.filter(
      (event) => event.event === "certificate.issue_failed",
    ).length;
    const immutable = this.events.filter(
      (event) => event.event === "certificate.immutability_violation",
    ).length;
    const checks: Array<{
      rule: CertificateAlert["rule"];
      fires: boolean;
      count: number;
      total?: number;
    }> = [
      {
        rule: "render_failure_rate",
        fires: renders.length > 0 && failures / renders.length > rules.renderFailureRatio,
        count: failures,
        total: renders.length,
      },
      { rule: "issuance_failures", fires: issuance > rules.issuanceFailureCount, count: issuance },
      {
        rule: "immutability_violation",
        fires: immutable > rules.immutabilityViolationCount,
        count: immutable,
      },
    ];
    return checks.flatMap(({ rule, fires, count, total }) => {
      if (fires === this.active.has(rule)) return [];
      if (fires) this.active.add(rule);
      else this.active.delete(rule);
      return [
        {
          rule,
          state: fires ? ("firing" as const) : ("resolved" as const),
          timestamp: new Date(now).toISOString(),
          count,
          ...(total === undefined ? {} : { total }),
        },
      ];
    });
  }
}
