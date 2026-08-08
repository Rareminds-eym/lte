import type { PagesContext } from "@functions/lib/types";
import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../[[path]]";

function createContext(url: string, init?: RequestInit) {
  const env = {
    ASSETS: {
      fetch: vi.fn(),
    },
  };
  return {
    context: { request: new Request(url, init), env } as unknown as PagesContext,
    fetchMock: env.ASSETS.fetch as ReturnType<typeof vi.fn>,
  };
}

describe("GET /dashboard", () => {
  it("returns the SPA shell with 200 for client routes", async () => {
    const { context, fetchMock } = createContext("http://localhost/dashboard");
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    fetchMock.mockResolvedValueOnce(
      new Response("<html>shell</html>", { status: 200, headers: { "content-type": "text/html" } }),
    );

    const response = await onRequest(context);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith(new URL("http://localhost/index.html"));
  });
});

describe("GET /api/v1/unknown", () => {
  it("returns a JSON 404, never the SPA shell", async () => {
    const { context, fetchMock } = createContext("http://localhost/api/v1/unknown");

    const response = await onRequest(context);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { message: "Not Found" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET existing asset", () => {
  it("passes the asset response through untouched", async () => {
    const { context, fetchMock } = createContext("http://localhost/assets/index-abc123.js");
    fetchMock.mockResolvedValueOnce(
      new Response("console.log('hi')", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );

    const response = await onRequest(context);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
  });
});

describe("GET missing asset", () => {
  it("returns a real 404 for asset-like paths instead of the shell", async () => {
    const { context, fetchMock } = createContext("http://localhost/assets/index-deadbeef.js");
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    const response = await onRequest(context);

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /unknown", () => {
  it("returns 404 for non-navigation methods", async () => {
    const { context, fetchMock } = createContext("http://localhost/whatever", { method: "POST" });

    const response = await onRequest(context);

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
