import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SsoSubscriptionSnapshot } from "../../shared/types";
import { asQueryGateway } from "../query-gateway";
import { syncSubscriptionCache } from "../sync-shadow";

vi.mock("../query-gateway", () => ({ asQueryGateway: vi.fn() }));
const upsert = vi.fn();
const subscription: SsoSubscriptionSnapshot = {
  id: "10000000-0000-4000-8000-000000000001",
  user_id: "20000000-0000-4000-8000-000000000001",
  organization_id: null,
  plan_id: "30000000-0000-4000-8000-000000000001",
  plan_code: "synthetic",
  plan_name: "Synthetic",
  plan_type: "synthetic",
  plan_amount: 0,
  billing_cycle: "none",
  status: "active",
  features: [],
  product_code: "lte",
  product_id: "40000000-0000-4000-8000-000000000001",
  subscription_start_date: null,
  subscription_end_date: null,
  updated_at: "2026-11-22T00:00:00Z",
  plan_revision_id: "50000000-0000-4000-8000-000000000001",
  lifecycle_state: { version: 1 },
  lifecycle_policy: { schemaVersion: 1 },
  lifecycle_activated_at: "2026-11-22T00:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  upsert.mockResolvedValue(undefined);
  vi.mocked(asQueryGateway).mockReturnValue({ upsert } as unknown as ReturnType<
    typeof asQueryGateway
  >);
});
describe("LTE cache revision transport", () => {
  it("uses the gateway column policy and retains every revision field", async () => {
    await syncSubscriptionCache({} as never, subscription);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        upsertColumns: expect.arrayContaining([
          "plan_revision_id",
          "lifecycle_state",
          "lifecycle_policy",
          "lifecycle_activated_at",
        ]),
      }),
      expect.objectContaining({
        plan_revision_id: subscription.plan_revision_id,
        lifecycle_state: subscription.lifecycle_state,
        lifecycle_policy: subscription.lifecycle_policy,
        lifecycle_activated_at: subscription.lifecycle_activated_at,
      }),
    );
  });
  it("surfaces persistence failure", async () => {
    upsert.mockRejectedValue(new Error("database unavailable"));
    await expect(syncSubscriptionCache({} as never, subscription)).rejects.toThrow(
      "Failed to sync subscription_cache",
    );
  });
});
