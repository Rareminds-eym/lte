import { expect, it } from "vitest";
import { CERTIFICATE_CONFIG, CERTIFICATE_COPY } from "../config";

it("bounds renderer and cleanup work and centralizes template copy", () => {
  expect(CERTIFICATE_CONFIG.rendererTimeoutMs).toBeLessThanOrEqual(30_000);
  expect(CERTIFICATE_CONFIG.cleanupBatchSize).toBeLessThanOrEqual(10);
  expect(CERTIFICATE_CONFIG.templateVersion).toBeGreaterThan(1);
  expect(CERTIFICATE_COPY.roleHeading).toBe("Certificate of Role Readiness");
});
