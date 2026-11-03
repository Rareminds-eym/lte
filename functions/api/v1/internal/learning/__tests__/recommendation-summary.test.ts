import { beforeEach, expect, it, vi } from "vitest";
import { levelId, signedContext } from "./helpers";

const f = vi.hoisted(() => ({ rpc: vi.fn(), create: vi.fn() }));
vi.mock("@functions/lib/query-gateway", () => ({ createServiceQueryGateway: f.create }));

import { onRequestPost } from "../recommendation-summary";

const summary = {
  schemaVersion: 1,
  evaluationPolicy: "human",
  revision: "a".repeat(32),
  truncated: false,
  levels: [
    {
      levelId,
      capabilityName: "Frontend",
      title: "Frontend L2",
      levelNumber: 2,
      fingerprint: "b".repeat(32),
    },
  ],
};
const payload = { userId: "20000000-0000-4000-8000-000000000001", evaluationPolicy: "human" };
beforeEach(() => {
  vi.clearAllMocks();
  f.create.mockReturnValue({ rpc: f.rpc });
  f.rpc.mockResolvedValue(summary);
});
it("returns only bounded approved summaries through the signed gateway", async () => {
  const response = await onRequestPost(await signedContext("recommendation-summary", payload));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(summary);
  expect(f.rpc).toHaveBeenCalledWith(
    expect.objectContaining({ functionName: "job_learning_recommendation_summary" }),
    { args: { p_user: payload.userId, p_policy: "human" } },
  );
});
it("rejects unsigned reads", async () => {
  const context = await signedContext("recommendation-summary", payload);
  context.request.headers.delete("x-lte-signature");
  expect((await onRequestPost(context)).status).toBe(401);
  expect(f.rpc).not.toHaveBeenCalled();
});
it.each([
  { ...payload, userId: null },
  { ...payload, levelIds: null },
])("rejects invalid or unbounded requests %j", async (body) => {
  expect((await onRequestPost(await signedContext("recommendation-summary", body))).status).toBe(
    400,
  );
  expect(f.rpc).not.toHaveBeenCalled();
});
it.each([
  { ...summary, levels: Array(51).fill(summary.levels[0]) },
  { ...summary, evaluationPolicy: "ai" },
  { ...summary, levels: [{ ...summary.levels[0], evidence: ["private"] }] },
])("fails closed on invalid upstream data", async (data) => {
  f.rpc.mockResolvedValue(data);
  expect((await onRequestPost(await signedContext("recommendation-summary", payload))).status).toBe(
    503,
  );
});

it("rejects a changed subject after the service signs the request", async () => {
  const context = await signedContext("recommendation-summary", payload);
  context.request = new Request(context.request.url, {
    method: "POST",
    headers: context.request.headers,
    body: JSON.stringify({ ...payload, userId: "20000000-0000-4000-8000-000000000002" }),
  });
  expect((await onRequestPost(context)).status).toBe(401);
  expect(f.create).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalled();
});
it("preserves the AI evaluation policy for a signed service request", async () => {
  const aiSummary = { ...summary, evaluationPolicy: "ai" };
  f.rpc.mockResolvedValue(aiSummary);
  const response = await onRequestPost(
    await signedContext("recommendation-summary", { ...payload, evaluationPolicy: "ai" }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(aiSummary);
  expect(f.rpc).toHaveBeenCalledWith(
    expect.objectContaining({ functionName: "job_learning_recommendation_summary" }),
    { args: { p_user: payload.userId, p_policy: "ai" } },
  );
});
