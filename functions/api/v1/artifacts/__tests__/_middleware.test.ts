import { describe, expect, it, vi } from "vitest";

const { requireAuthMock } = vi.hoisted(() => ({ requireAuthMock: vi.fn() }));

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: requireAuthMock };
});

import { onRequest } from "@functions/api/v1/artifacts/_middleware";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError } from "@functions/middleware";

function createContext(): PagesContext<LteEnv> {
  const next = vi.fn().mockResolvedValue(new Response("handled", { status: 200 }));
  return {
    request: new Request("http://localhost/api/v1/artifacts/submit"),
    env: {} as LteEnv,
    params: {},
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    next,
    data: {},
  };
}

describe("artifacts _middleware", () => {
  it("authenticates and continues the chain with the user on context.data", async () => {
    requireAuthMock.mockResolvedValue({ sub: "user-1", products: ["lte"] });
    const context = createContext();

    const response = await onRequest(context);

    expect(requireAuthMock).toHaveBeenCalledWith(context.request, context.env);
    expect(context.data?.["user"]).toMatchObject({ sub: "user-1" });
    expect(context.next).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("returns 401 and short-circuits when auth fails", async () => {
    requireAuthMock.mockRejectedValue(new AuthError("Missing bearer token", "UNAUTHORIZED"));
    const context = createContext();

    const response = await onRequest(context);

    expect(response.status).toBe(401);
    expect(context.next).not.toHaveBeenCalled();
  });

  it("returns 403 when the user lacks lte access", async () => {
    requireAuthMock.mockRejectedValue(new AuthError("LTE access is required", "FORBIDDEN"));
    const context = createContext();

    const response = await onRequest(context);

    expect(response.status).toBe(403);
    expect(context.next).not.toHaveBeenCalled();
  });
});
