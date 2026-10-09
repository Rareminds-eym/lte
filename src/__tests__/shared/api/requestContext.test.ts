import { expect, it } from "vitest";
import { requestCorrelationHeaders } from "@/shared/api";

it("creates safe W3C headers without overwriting other request headers", () => {
  const headers = requestCorrelationHeaders({
    "Content-Type": "application/json",
    "X-Request-Id": "learner@example.test",
  });
  expect(headers.get("traceparent")).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
  expect(headers.get("X-Request-Id")).toMatch(/^[a-f0-9]{32}$/);
  expect(headers.get("Content-Type")).toBe("application/json");
  expect(requestCorrelationHeaders(headers).get("X-Request-Id")).toBe(headers.get("X-Request-Id"));
});
