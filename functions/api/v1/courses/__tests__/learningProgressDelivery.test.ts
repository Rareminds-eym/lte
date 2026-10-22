import { dispatchLearningProgress } from "@functions/lib/learningProgressDelivery";
import type { QueryGateway, QueryGatewayRpcPolicy } from "@functions/lib/query-gateway";
import type { LteEnv } from "@functions/lib/types";
import { expect, it, vi } from "vitest";
import { makeGateway, mockChain, ok } from "./helpers";

function fixture(status = "not_started") {
  const base = makeGateway({
    levels: mockChain({
      maybeSingle: ok({ capability_id: "cap", title: "Level" }),
      thenQueue: [ok([{ id: "lvl", level_code: "L1", title: "Level" }])],
    }),
    capabilities: mockChain({ maybeSingle: ok({ name: "Capability", code: "CAP" }) }),
    user_capability_level_progress: mockChain({ thenVal: ok([{ level_id: "lvl", status }]) }),
    user_module_progress: mockChain({ thenVal: ok([]) }),
    modules: mockChain({
      thenVal: ok([{ id: "module", level_id: "lvl", module_no: 1, title: "Unstarted module" }]),
    }),
    level_skills: mockChain({ thenVal: ok([]) }),
    skills: mockChain({ thenVal: ok([]) }),
  });
  const rpc = vi.fn(async (p: QueryGatewayRpcPolicy) =>
    p.functionName === "claim_learning_progress_delivery"
      ? [
          {
            user_id: "10000000-0000-4000-8000-000000000001",
            level_id: "20000000-0000-4000-8000-000000000001",
            lease_token: "30000000-0000-4000-8000-000000000001",
          },
        ]
      : null,
  );
  return { qb: { ...base, rpc } as QueryGateway, rpc };
}
async function decode(bytes: Uint8Array) {
  return JSON.parse(
    await new Response(
      new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).text(),
  );
}
it("recovery preserves unstarted persisted progress and does not fabricate module completion", async () => {
  const { qb, rpc } = fixture(),
    send = vi.fn().mockResolvedValue(undefined);
  await dispatchLearningProgress(qb, { LTE_SYNC_QUEUE: { send } } as unknown as LteEnv);
  const event = await decode(send.mock.calls[0]?.[0]);
  expect(event.payload.levels[0].status).toBe("not_started");
  expect(event.payload.levels[0].modules[0].status).toBe("not_started");
  expect(event.payload.completedModules).toBe(0);
  expect(rpc).toHaveBeenCalledWith(
    expect.objectContaining({ functionName: "finish_learning_progress_delivery" }),
    {
      args: expect.objectContaining({
        p_token: "30000000-0000-4000-8000-000000000001",
        p_success: true,
      }),
    },
  );
});
it("recovery does not invent missing module rows even for a persisted completed level", async () => {
  const { qb } = fixture("completed"),
    send = vi.fn().mockResolvedValue(undefined);
  await dispatchLearningProgress(qb, { LTE_SYNC_QUEUE: { send } } as unknown as LteEnv);
  const event = await decode(send.mock.calls[0]?.[0]);
  expect(event.payload.levels[0].status).toBe("completed");
  expect(event.payload.completedModules).toBe(0);
});
it("failed queue sends finish the lease as failure for backoff rather than acknowledging it", async () => {
  const { qb, rpc } = fixture(),
    send = vi.fn().mockRejectedValue(new Error("Queue unavailable"));
  await dispatchLearningProgress(qb, { LTE_SYNC_QUEUE: { send } } as unknown as LteEnv);
  expect(rpc).not.toHaveBeenCalledWith(
    expect.objectContaining({ functionName: "ack_learning_progress_delivery" }),
    expect.anything(),
  );
  expect(rpc).toHaveBeenCalledWith(
    expect.objectContaining({ functionName: "finish_learning_progress_delivery" }),
    { args: expect.objectContaining({ p_success: false }) },
  );
});

it("settles siblings and processes later claimed batches before reporting finish failure", async () => {
  const { qb } = fixture();
  const rows = Array.from({ length: 6 }, () => ({
    user_id: crypto.randomUUID(),
    level_id: crypto.randomUUID(),
    lease_token: crypto.randomUUID(),
  }));
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const finished: string[] = [];
  const rpc = vi.fn(
    async (policy: QueryGatewayRpcPolicy, options?: { args?: Record<string, unknown> }) => {
      if (policy.functionName === "claim_learning_progress_delivery") return rows;
      if (policy.functionName === "finish_learning_progress_delivery") {
        const user = String(options?.args?.["p_user"]);
        if (user === rows[0]?.user_id) throw new Error("Synthetic finish failure");
        if (user === rows[1]?.user_id) await pending;
        finished.push(user);
      }
      return null;
    },
  );
  let settled = false;
  const outcome = dispatchLearningProgress(
    { ...qb, rpc } as QueryGateway,
    { LTE_SYNC_QUEUE: { send: vi.fn().mockResolvedValue(undefined) } } as unknown as LteEnv,
  ).then(
    () => {
      settled = true;
      return null;
    },
    (error) => {
      settled = true;
      return error;
    },
  );
  try {
    await vi.waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "finish_learning_progress_delivery" }),
        expect.objectContaining({ args: expect.objectContaining({ p_user: rows[1]?.user_id }) }),
      ),
    );
    expect(settled).toBe(false);
  } finally {
    release();
  }
  expect(await outcome).toBeInstanceOf(AggregateError);
  expect(finished).toContain(rows[1]?.user_id);
  expect(finished).toContain(rows[5]?.user_id);
});
it("rejects malformed delivery claims before sending or finishing anything", async () => {
  const { qb } = fixture();
  const rpc = vi.fn().mockResolvedValue([{ user_id: "invalid" }]);
  const send = vi.fn();
  await expect(
    dispatchLearningProgress({ ...qb, rpc }, { LTE_SYNC_QUEUE: { send } } as unknown as LteEnv),
  ).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledTimes(1);
});
