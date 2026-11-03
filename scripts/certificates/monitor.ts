/** Pipe the existing certificate log stream here; alert transitions go to JSON stdout. */
import process from "node:process";
import { createInterface } from "node:readline";
import { CertificateAlertMonitor, parseCertificateLog } from "../../functions/lib/certificates/monitoring";
const monitor = new CertificateAlertMonitor();
function output(events: ReturnType<CertificateAlertMonitor["evaluate"]>) {
  for (const event of events) process.stdout.write(`${JSON.stringify(event)}\n`);
}
const timer = setInterval(() => output(monitor.evaluate()), 1000);
try {
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    const event = parseCertificateLog(line);
    if (event) output(monitor.ingest(event));
  }
} finally { clearInterval(timer); }
