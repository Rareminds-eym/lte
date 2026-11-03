import { expect, it } from "vitest";
import { requestCorrelation } from "../requestContext";

it("rejects sensitive correlation text and preserves opaque identifiers and W3C traces", () => {
  const traceparent = `00-${"a".repeat(32)}-${"b".repeat(16)}-01`;
  const id = "12345678-1234-4234-8234-123456789abc";
  const request = new Request("https://lte.test", { headers: { traceparent, "X-Request-Id": id } });
  expect(requestCorrelation(request)).toEqual({ traceparent, requestId: id });
  request.headers.set("X-Request-Id", "learner@example.test");
  expect(requestCorrelation(request).requestId).toBe("a".repeat(32));
  request.headers.set("traceparent", `00-${"0".repeat(32)}-${"0".repeat(16)}-01`);
  expect(requestCorrelation(request).traceparent).not.toContain("00000000000000000000000000000000");
});
