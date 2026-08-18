import { TEST_GATEWAY_SECRET as SECRET } from "@functions/lib/__tests__/test-secrets";
import { signServiceToken, signUserClaim } from "@functions/lib/gateway/gateway-crypto";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCapabilitiesGet } from "../capabilities/actions/capabilities-get";
import { CALLER_APP } from "../core/contract";
import { getPublicOrigin, onRequestPost, REGISTRY, SUPPORTED_ACTIONS } from "../index";
import { handleSkillsGet } from "../skills/actions/skills-get";

// Unit-test the gateway SHELL (index.ts) in isolation: the handlers are mocked
// so this file owns the request -> dispatch -> envelope contract, not the
// business logic (that lives in capabilities/__tests__/gateway.test.ts and the
// action-specific suites).
vi.mock("../capabilities/actions/capabilities-get", () => ({
  handleCapabilitiesGet: vi.fn(),
}));

vi.mock("../skills/actions/skills-get", () => ({
  handleSkillsGet: vi.fn(),
}));

const APP = CALLER_APP;
const USER_ID = "11111111-1111-4111-8111-111111111111";
const URL = "http://lte.test/api/internal/skillpassport";

const env = {
  SKILLPASSPORT_INTERNAL_SECRET: SECRET,
} as unknown as LteEnv;

async function buildRequest(body: unknown): Promise<Request> {
  const now = Math.floor(Date.now() / 1000);
  const token = await signServiceToken(SECRET, {
    app: APP,
    actions: ["capabilities:get", "skills:get"],
    iat: now,
    exp: now + 300,
  });
  const { claim, sig } = await signUserClaim(SECRET, USER_ID);
  return new Request(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Lte-Claim": claim,
      "X-Lte-Sig": sig,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(request: Request): PagesContext<LteEnv> {
  return { request, env } as unknown as PagesContext<LteEnv>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gateway contract (index.ts exports)", () => {
  it("registers every supported action to its handler", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual(["capabilities:get", "skills:get"]);
    expect(REGISTRY["capabilities:get"]).toBe(handleCapabilitiesGet);
    expect(REGISTRY["skills:get"]).toBe(handleSkillsGet);
  });

  it("derives SUPPORTED_ACTIONS from the registry so the two cannot drift", () => {
    expect(SUPPORTED_ACTIONS).toEqual(Object.keys(REGISTRY));
    expect(SUPPORTED_ACTIONS).toContain("capabilities:get");
    expect(SUPPORTED_ACTIONS).toContain("skills:get");
  });

  it("pins the caller app the service token must present", () => {
    expect(CALLER_APP).toBe("skillpassport");
  });
});

describe("getPublicOrigin", () => {
  it("returns the scheme and host of the request url", () => {
    expect(getPublicOrigin(new Request(`${URL}?foo=1`))).toBe("http://lte.test");
  });

  it("preserves the port so local-dev resumeUrls keep it", () => {
    expect(getPublicOrigin(new Request("http://127.0.0.1:8789/api/internal/skillpassport"))).toBe(
      "http://127.0.0.1:8789",
    );
  });

  it("reflects the request protocol", () => {
    expect(getPublicOrigin(new Request("https://lte.test/api/internal/skillpassport"))).toBe(
      "https://lte.test",
    );
  });
});

describe("onRequestPost auth and error guard rails", () => {
  it("fails closed with 403 when the gateway secret is missing", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { Authorization: "Bearer not-needed" },
      body: JSON.stringify({ action: "capabilities:get", requestId: "r1", payload: {} }),
    });

    const response = await onRequestPost({
      request,
      env: {},
    } as unknown as PagesContext<LteEnv>);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", message: "Gateway secret is missing or too short" },
    });
  });

  it("fails closed with 403 when the gateway secret is shorter than 32 characters", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { Authorization: "Bearer not-needed" },
      body: JSON.stringify({ action: "capabilities:get", requestId: "r1", payload: {} }),
    });

    const response = await onRequestPost({
      request,
      env: { SKILLPASSPORT_INTERNAL_SECRET: "short" },
    } as unknown as PagesContext<LteEnv>);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", message: "Gateway secret is missing or too short" },
    });
  });

  it("returns an opaque 500 when a non-auth failure escapes the try block", async () => {
    // `env` is undefined, so getGatewaySecret dereferences it into a plain
    // TypeError — the terminal catch must not leak internals.
    const request = new Request(URL, {
      method: "POST",
      body: JSON.stringify({ action: "capabilities:get", requestId: "r1", payload: {} }),
    });

    const response = await onRequestPost({ request } as unknown as PagesContext<LteEnv>);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Internal gateway error" },
    });
  });
});

describe("onRequestPost dispatch and envelope mapping", () => {
  it("dispatches capabilities:get with the verified claim and request origin as context", async () => {
    vi.mocked(handleCapabilitiesGet).mockResolvedValue({
      ok: true,
      data: { capabilities: [] },
    });

    const request = await buildRequest({
      action: "capabilities:get",
      requestId: "req-99",
      payload: { userId: USER_ID },
    });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-ID")).toBe("req-99");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      requestId: "req-99",
      data: { capabilities: [] },
    });
    expect(handleCapabilitiesGet).toHaveBeenCalledOnce();
    expect(handleCapabilitiesGet).toHaveBeenCalledWith(
      expect.objectContaining({
        env,
        request,
        requestId: "req-99",
        userId: USER_ID,
        origin: "http://lte.test",
      }),
      { userId: USER_ID },
    );
  });

  it("dispatches skills:get to its own handler", async () => {
    vi.mocked(handleSkillsGet).mockResolvedValue({
      ok: true,
      data: { skills: [] },
    });

    const request = await buildRequest({
      action: "skills:get",
      requestId: "req-100",
      payload: { userId: USER_ID },
    });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(200);
    expect(handleSkillsGet).toHaveBeenCalledOnce();
    expect(handleCapabilitiesGet).not.toHaveBeenCalled();
    expect(handleSkillsGet).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-100", userId: USER_ID, origin: "http://lte.test" }),
      { userId: USER_ID },
    );
  });

  it("maps a handler UNKNOWN_ACTION error envelope to a 404", async () => {
    vi.mocked(handleCapabilitiesGet).mockResolvedValue({
      ok: false,
      error: { code: "UNKNOWN_ACTION", message: "Unknown action: bogus" },
    });

    const request = await buildRequest({
      action: "capabilities:get",
      requestId: "req-101",
      payload: { userId: USER_ID },
    });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      requestId: "req-101",
      error: { code: "UNKNOWN_ACTION", message: "Unknown action: bogus" },
    });
  });

  it("falls back to 500 for handler error codes that are not in the status map", async () => {
    vi.mocked(handleCapabilitiesGet).mockResolvedValue({
      ok: false,
      error: { code: "CUSTOM_ERROR", message: "not registered" },
    });

    const request = await buildRequest({
      action: "capabilities:get",
      requestId: "req-102",
      payload: { userId: USER_ID },
    });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      requestId: "req-102",
      error: { code: "CUSTOM_ERROR", message: "not registered" },
    });
  });
});
