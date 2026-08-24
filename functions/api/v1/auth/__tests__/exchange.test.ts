import type { LteEnv, PagesContext } from "@functions/lib/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost } from "../sso/exchange";

vi.mock("@functions/lib/env", () => ({ validateBackendEnv: vi.fn() }));
vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn(() => ({})) }));
vi.mock("@functions/lib/sync-shadow", () => ({ syncSsoShadowData: vi.fn(async () => {}) }));
vi.mock("@functions/lib/xp-engine", () => ({
  triggerDailyLoginWithEngagement: vi.fn(() => Promise.resolve()),
}));

const ssoUser = {
  sub: "user-uuid-1234",
  org_id: "org-1",
  email: "learner@rareminds.com",
  roles: ["learner"],
  products: ["lte"],
};

function makeExchangeResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: "at-123",
    refresh_token: "rt-456",
    expires_in: 900,
    user: { ...ssoUser, ...overrides },
    subscription: null,
  };
}

function postContext(ssoMock: Record<string, unknown>, body?: Record<string, unknown>) {
  return {
    request: new Request("http://localhost/api/v1/auth/sso/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        body ?? {
          code: "oauth-code",
          state: "oauth-state",
          redirectUri: "http://localhost/callback",
        },
      ),
    }),
    env: { SSO_SERVICE: ssoMock },
    data: {},
  } as unknown as PagesContext<LteEnv>;
}

const happySso = (): Record<string, unknown> => ({
  exchangeAuthorizationCode: vi.fn().mockResolvedValue(makeExchangeResponse()),
  provisionLteAccess: vi.fn().mockResolvedValue({ success: true, alreadyProvisioned: false }),
});

describe("POST /api/v1/auth/sso/exchange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 400 when code/state/redirectUri are missing", async () => {
    const response = await onRequestPost(postContext(happySso(), { code: "c" }));
    expect(response.status).toBe(400);
  });

  it("returns a sanitized 401 (no upstream message leak) when the exchange RPC throws", async () => {
    const sso = {
      exchangeAuthorizationCode: vi
        .fn()
        .mockRejectedValue(new Error("INTERNAL driver exploded: select * from secrets")),
      provisionLteAccess: vi.fn(),
    };
    const response = await onRequestPost(postContext(sso));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.message).toBe("Authentication failed");
    expect(JSON.stringify(body)).not.toContain("driver exploded");
    expect(body.error.code).toBe("AUTH_EXCHANGE_FAILED");
    expect(body.requestId).toBeTruthy();
  });

  it("returns 403 when the exchanged user lacks the lte product", async () => {
    const sso = happySso();
    (sso["exchangeAuthorizationCode"] as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeExchangeResponse({ products: ["other"] }),
    );
    const response = await onRequestPost(postContext(sso));
    expect(response.status).toBe(403);
  });

  // FAIL-CLOSED: no tokens/cookie may be issued when provisioning did not succeed.
  it("returns 503 and sets NO refresh cookie when provisioning reports success:false", async () => {
    const sso = happySso();
    (sso["provisionLteAccess"] as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });
    const response = await onRequestPost(postContext(sso));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("LTE_PROVISIONING_FAILED");
    expect(body.requestId).toBeTruthy();
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(body.access_token).toBeUndefined();
  });

  it("returns 503 and sets NO refresh cookie when provisioning throws", async () => {
    const sso = happySso();
    (sso["provisionLteAccess"] as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("rpc down"),
    );
    const response = await onRequestPost(postContext(sso));

    expect(response.status).toBe(503);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await response.json()).toMatchObject({
      error: { code: "LTE_PROVISIONING_FAILED" },
    });
  });

  it("returns a sanitized 401 when the exchange RPC exceeds the bounded timeout", async () => {
    vi.useFakeTimers();
    const sso = {
      exchangeAuthorizationCode: vi.fn().mockReturnValue(new Promise(() => {})),
      provisionLteAccess: vi.fn(),
    };
    const pending = onRequestPost(postContext(sso));
    await vi.advanceTimersByTimeAsync(8_000);
    const response = await pending;
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_EXCHANGE_FAILED");
    expect(body.requestId).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("timed out after"); // sanitized
  });

  it("issues tokens + HttpOnly refresh cookie and registers the XP background task on success", async () => {
    const waitUntil = vi.fn();
    const ctx = postContext(happySso());
    (ctx as { waitUntil?: unknown }).waitUntil = waitUntil;

    const response = await onRequestPost(ctx);
    const body = await response.json();
    const cookie = response.headers.get("Set-Cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body.access_token).toBe("at-123");
    expect(cookie).toContain("__Host-rm-refresh=rt-456");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=604800");
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("provisions BEFORE issuing any tokens (blocking order)", async () => {
    const calls: string[] = [];
    const sso = {
      exchangeAuthorizationCode: vi.fn(async () => {
        calls.push("exchange");
        return makeExchangeResponse();
      }),
      provisionLteAccess: vi.fn(async () => {
        calls.push("provision");
        return { success: true, alreadyProvisioned: true };
      }),
    };
    await onRequestPost(postContext(sso));
    expect(calls.indexOf("provision")).toBeGreaterThan(-1);
    expect(calls).toEqual(["exchange", "provision"]);
  });
});
