import { QueryGatewayDatabaseError } from "@functions/lib/query-gateway";
import { expect, it, vi } from "vitest";
import { certificateLogger, errorCode, logCertificateFailure } from "../logging";

it("logs once, retains diagnostic stack locations, and does not count unrelated errors as issuance", () => {
  const spy = vi.spyOn(certificateLogger, "error").mockImplementation(() => undefined);
  const error = new Error("secret@example.test");
  logCertificateFailure(error, { requestId: "request", operation: "list" });
  logCertificateFailure(error, { requestId: "request", operation: "issue" });
  expect(spy).toHaveBeenCalledOnce();
  expect(spy.mock.calls[0]?.[0]).toBe("certificate.list_failed");
  const logged = spy.mock.calls[0]?.[1] as Error;
  expect(logged.stack).not.toContain("secret@example.test");
  expect(logged.stack).toContain("logging.test.ts");
  spy.mockRestore();
});
it("preserves database codes for collision handling and immutability monitoring", () => {
  const spy = vi.spyOn(certificateLogger, "error").mockImplementation(() => undefined);
  const error = new QueryGatewayDatabaseError("failed", { code: "23514", message: "private" });
  expect(errorCode(error)).toBe("23514");
  logCertificateFailure(error, { operation: "issue" });
  expect(spy.mock.calls[0]?.[0]).toBe("certificate.immutability_violation");
  spy.mockRestore();
});
