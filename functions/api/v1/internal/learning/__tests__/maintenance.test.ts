import { beforeEach, expect, it, vi } from "vitest";
import { signedContext } from "./helpers";

const f = vi.hoisted(() => ({ review: vi.fn(), progress: vi.fn(), rpc: vi.fn() }));
vi.mock("@functions/lib/human-review/dispatch", () => ({ dispatchReviewWork: f.review }));
vi.mock("@functions/lib/learningProgressDelivery", () => ({
  dispatchLearningProgress: f.progress,
}));
vi.mock("@functions/lib/query-gateway", () => ({
  createServiceQueryGateway: () => ({ rpc: f.rpc }),
}));

import { onRequestPost, runLearningMaintenanceTasks } from "../maintenance";

beforeEach(() => {
  vi.clearAllMocks();
  f.review.mockResolvedValue(undefined);
  f.progress.mockResolvedValue(undefined);
  f.rpc.mockResolvedValue(null);
});
it("continues progress recovery when review delivery fails", async () => {
  f.review.mockRejectedValue(new Error("Review transport unavailable"));
  await expect(
    runLearningMaintenanceTasks({} as Parameters<typeof runLearningMaintenanceTasks>[0]),
  ).rejects.toThrow("maintenance tasks failed");
  expect(f.progress).toHaveBeenCalledOnce();
  expect(f.rpc).not.toHaveBeenCalled();
});
it("continues review delivery when progress recovery fails", async () => {
  f.progress.mockRejectedValue(new Error("Progress unavailable"));
  await expect(
    runLearningMaintenanceTasks({} as Parameters<typeof runLearningMaintenanceTasks>[0]),
  ).rejects.toThrow("maintenance tasks failed");
  expect(f.review).toHaveBeenCalledOnce();
});
it("awaits both independent maintenance paths before completing", async () => {
  await expect(
    runLearningMaintenanceTasks({} as Parameters<typeof runLearningMaintenanceTasks>[0]),
  ).resolves.toBeUndefined();
  expect(f.progress).toHaveBeenCalledOnce();
  expect(f.review).toHaveBeenCalledOnce();
});

it("does not schedule historical reconciliation during routine maintenance", async () => {
  await runLearningMaintenanceTasks({} as Parameters<typeof runLearningMaintenanceTasks>[0]);
  expect(f.rpc).not.toHaveBeenCalled();
});

it("returns correlated success from the signed HTTP boundary", async () => {
  const response = await onRequestPost(await signedContext("maintenance"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(f.progress).toHaveBeenCalledOnce();
  expect(response.headers.get("X-Request-Id")).toBeTruthy();
});
it("returns a sanitized HTTP failure after both maintenance paths run", async () => {
  f.review.mockRejectedValueOnce(new Error("Private review error"));
  const response = await onRequestPost(await signedContext("maintenance"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("Private review error");
  expect(f.progress).toHaveBeenCalledOnce();
});
