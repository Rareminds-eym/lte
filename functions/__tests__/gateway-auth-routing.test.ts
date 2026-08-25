import type { PagesContext } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSsoGatewayMock, handleBrowserRequestMock } = vi.hoisted(() => ({
  createSsoGatewayMock: vi.fn(),
  handleBrowserRequestMock: vi.fn(),
}));

vi.mock("@rareminds-eym/sso-gateway", () => ({
  createSsoGateway: (...args: unknown[]) => createSsoGatewayMock(...args),
}));

// [[path]].ts memoizes the gateway at module level — reset modules per test so
// cache state never leaks between cases.
async function importRouter() {
  vi.resetModules();
  const mod = await import("../[[path]]");
  return mod;
}

function createContext(url: string) {
  const env = {
    SSO_SERVICE: { __isBinding: true },
    ASSETS: { fetch: vi.fn() },
  };
  return {
    context: { request: new Request(url), env } as unknown as PagesContext,
    fetchMock: env.ASSETS.fetch as ReturnType<typeof vi.fn>,
  };
}

beforeEach(() => {
  createSsoGatewayMock.mockReset();
  handleBrowserRequestMock.mockReset();
  createSsoGatewayMock.mockReturnValue({ handleBrowserRequest: handleBrowserRequestMock });
});

describe("functions/[[path]] auth gateway delegation", () => {
  it("delegates /api/auth/* browser routes through the sso gateway", async () => {
    const { onRequest } = await importRouter();
    const gatewayResponse = new Response(null, { status: 302 });
    handleBrowserRequestMock.mockResolvedValueOnce(gatewayResponse);
    const { context } = createContext("http://localhost/api/auth/refresh");

    const response = await onRequest(context);

    expect(handleBrowserRequestMock).toHaveBeenCalledTimes(1);
    expect(response).toBe(gatewayResponse);
  });

  it("returns 502 with a correlation id when the gateway dispatch throws", async () => {
    const { onRequest } = await importRouter();
    handleBrowserRequestMock.mockRejectedValueOnce(new Error("binding exploded"));
    const { context } = createContext("http://localhost/api/auth/refresh");

    const response = await onRequest(context);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("SSO_GATEWAY_UNAVAILABLE");
    expect(body.requestId).toBeTruthy();
  });

  it("never delegates the exact sso exchange path", async () => {
    const { onRequest } = await importRouter();
    const { context, fetchMock } = createContext("http://localhost/api/v1/auth/sso/exchange");

    const response = await onRequest(context);

    expect(handleBrowserRequestMock).not.toHaveBeenCalled();
    expect(response.status).toBe(404); // falls through to API fallback in unit scope
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never delegates a trailing-slash variant of the exchange path", async () => {
    const { onRequest } = await importRouter();
    const { context } = createContext("http://localhost/api/v1/auth/sso/exchange/");

    await onRequest(context);

    expect(handleBrowserRequestMock).not.toHaveBeenCalled();
  });

  it("memoizes the gateway across requests for the same binding (M4)", async () => {
    const { onRequest } = await importRouter();
    handleBrowserRequestMock.mockResolvedValue(new Response(null, { status: 204 }));
    // Production isolates see one stable binding reference per deploy.
    const sharedBinding = { __isBinding: true };
    const makeCtx = (url: string) => {
      const ctx = createContext(url);
      (ctx.context as { env: { SSO_SERVICE: unknown } }).env.SSO_SERVICE = sharedBinding;
      return ctx.context;
    };

    await onRequest(makeCtx("http://localhost/api/auth/session"));
    await onRequest(makeCtx("http://localhost/api/auth/logout"));

    expect(createSsoGatewayMock).toHaveBeenCalledTimes(1);
  });
});
