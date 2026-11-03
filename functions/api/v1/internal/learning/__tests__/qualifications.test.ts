import { beforeEach, expect, it, vi } from "vitest";
import { signedContext, snapshot } from "./helpers";

const f = vi.hoisted(() => ({ rpc: vi.fn(), create: vi.fn() }));
vi.mock("@functions/lib/query-gateway", () => ({ createServiceQueryGateway: f.create }));

import { onRequestPost } from "../qualifications";

beforeEach(() => {
  vi.clearAllMocks();
  f.create.mockReturnValue({ rpc: f.rpc });
  f.rpc.mockResolvedValue(snapshot());
});
const payload = { userId: null, levelIds: null };
it("returns validated catalog output and forwards correlation to the gateway", async () => {
  const response = await onRequestPost(await signedContext("qualifications", payload));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(snapshot());
  expect(f.rpc).toHaveBeenCalledWith(
    expect.objectContaining({ functionName: "job_learning_snapshot" }),
    { args: { p_user: null, p_levels: null, p_policy: "human" } },
  );
  expect(f.create).toHaveBeenCalledWith(expect.anything(), {
    requestId: response.headers.get("X-Request-Id"),
    traceparent: response.headers.get("traceparent"),
  });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it.each([
  { userId: "invalid", levelIds: null },
  { ...payload, unexpected: true },
])("rejects invalid request %j without database work", async (body) => {
  expect((await onRequestPost(await signedContext("qualifications", body))).status).toBe(400);
  expect(f.rpc).not.toHaveBeenCalled();
});
it("rejects malformed JSON before database work", async () => {
  expect((await onRequestPost(await signedContext("qualifications", undefined, "{"))).status).toBe(
    400,
  );
  expect(f.rpc).not.toHaveBeenCalled();
});
it("rejects unsigned access before database work", async () => {
  const ctx = await signedContext("qualifications", payload);
  ctx.request.headers.delete("x-lte-signature");
  expect((await onRequestPost(ctx)).status).toBe(401);
  expect(f.rpc).not.toHaveBeenCalled();
});
it.each([
  { levels: [{ garbage: true }] },
  { ...snapshot(), schemaVersion: 2 },
  null,
])("fails closed on malformed RPC response %j", async (data) => {
  f.rpc.mockResolvedValueOnce(data);
  const response = await onRequestPost(await signedContext("qualifications", payload));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("garbage");
});
it("returns sanitized correlated errors for database outages", async () => {
  f.rpc.mockRejectedValueOnce(new Error("secret driver internals"));
  const response = await onRequestPost(await signedContext("qualifications", payload));
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.requestId).toBe(response.headers.get("X-Request-Id"));
  expect(JSON.stringify(body)).not.toContain("secret driver internals");
});
it("accepts authoritative staff-review and independent AI evidence contracts", async () => {
  const data = snapshot();
  const level = data.levels[0];
  if (!level) throw new Error("Missing fixture level");
  level.approved = true;
  level.evidence = [
    {
      submissionId: crypto.randomUUID(),
      reviewId: crypto.randomUUID(),
      reviewVersion: 1,
      evaluationId: crypto.randomUUID(),
      evaluationType: "staff_review",
      reviewedAt: "2026-10-22T10:00:00+00:00",
    },
  ];
  f.rpc.mockResolvedValueOnce(data);
  expect((await onRequestPost(await signedContext("qualifications", payload))).status).toBe(200);
  data.evaluationPolicy = "ai";
  const evidence = level.evidence[0];
  if (!evidence) throw new Error("Missing fixture evidence");
  level.evidence[0] = {
    ...evidence,
    evaluationType: "ai",
    reviewId: null,
    reviewVersion: null,
  };
  f.rpc.mockResolvedValueOnce(data);
  expect(
    (
      await onRequestPost(
        await signedContext("qualifications", { ...payload, evaluationPolicy: "ai" }),
      )
    ).status,
  ).toBe(200);
});
