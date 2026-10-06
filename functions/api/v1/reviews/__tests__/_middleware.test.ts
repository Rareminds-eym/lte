import type { LteEnv, PagesContext } from "@functions/lib/types";
import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../_middleware";

const auth = vi.hoisted(() => ({ authenticate: vi.fn(), requireActiveMembership: vi.fn() }));
vi.mock("@functions/middleware", () => ({ getAuthInstance: () => auth }));
describe("review authentication middleware", () => {
  it("delegates authentication and membership before forwarding the verified user", async () => {
    const user = { sub: "verified-user" };
    auth.authenticate.mockImplementation((handler) => handler);
    auth.requireActiveMembership.mockImplementation(
      (handler) => (request: Request) => handler(request, { user }),
    );
    const context = {
      request: new Request("https://lte.test/api/v1/reviews/queue"),
      env: {},
      data: { requestId: "trace" },
      next: vi.fn().mockResolvedValue(new Response("ok")),
    } as unknown as PagesContext<LteEnv>;
    expect((await onRequest(context)).status).toBe(200);
    expect(context.data).toEqual({ requestId: "trace", user });
    expect(context.next).toHaveBeenCalledOnce();
  });
  it("does not forward a request denied by membership enforcement", async () => {
    auth.authenticate.mockImplementation((handler) => handler);
    auth.requireActiveMembership.mockReturnValue(() => new Response("Denied", { status: 403 }));
    const context = {
      request: new Request("https://lte.test/api/v1/reviews/queue"),
      env: {},
      data: {},
      next: vi.fn(),
    } as unknown as PagesContext<LteEnv>;
    expect((await onRequest(context)).status).toBe(403);
    expect(context.next).not.toHaveBeenCalled();
  });
});
