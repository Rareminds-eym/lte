import { expect, it } from "vitest";
import { CERTIFICATE_CLIENT_CONFIG, CERTIFICATE_LABELS } from "@/entities/certificate";

it("centralizes bounded client settings and all status/type labels", () => {
  expect(CERTIFICATE_CLIENT_CONFIG.apiPath).toBe("/api/v1/certificates");
  expect(CERTIFICATE_CLIENT_CONFIG.listTimeoutMs).toBeGreaterThan(0);
  expect(CERTIFICATE_LABELS.statuses).toHaveProperty("pending_name");
  expect(CERTIFICATE_LABELS.retryAfter(12)).toBe("Please retry in 12 seconds.");
});
