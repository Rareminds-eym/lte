import type { PagesContext } from "@functions/lib/types";
import { expect, it, vi } from "vitest";
import {
  certificateError,
  certificateRequestContext,
  correlateResponse,
  ownerId,
  summary,
} from "../http";
import { env, row } from "./fixtures";

it("propagates valid correlation and replaces malformed or zero trace IDs", () => {
  const ctx = {
    env,
    request: new Request("https://lte.test", {
      headers: { traceparent: `00-${"0".repeat(32)}-${"0".repeat(16)}-01` },
    }),
    data: {},
  } as unknown as PagesContext;
  const correlation = certificateRequestContext(ctx);
  expect(correlation.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
  expect(correlation.traceparent).not.toContain("00000000000000000000000000000000");
  ctx.data = correlation;
  expect(certificateRequestContext(ctx)).toEqual(correlation);
  const response = correlateResponse(
    Response.redirect("https://lte.test"),
    correlation.requestId,
    correlation.traceparent,
  );
  expect(response.headers.get("X-Request-Id")).toBe(correlation.requestId);
});
it("requires authenticated ownership and exposes only minimal learner summaries", () => {
  expect(() => ownerId({ data: {} } as PagesContext)).toThrow();
  expect(summary(row, env as PagesContext["env"])).not.toHaveProperty("user_id");
  expect(
    summary({ ...row, status: "pending_name" }, env as PagesContext["env"]).verifyUrl,
  ).toBeNull();
});
it("logs unexpected errors server-side without leaking sensitive messages to clients", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const response = certificateError(new Error("private-driver-information"), "request");
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private-driver-information");
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
it("returns the immutable learner name for the owner's certificate preview", () => {
  expect(summary(row, env)).toHaveProperty("learnerName", row.learner_name);
});
