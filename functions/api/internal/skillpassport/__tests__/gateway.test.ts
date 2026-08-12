import { getUserCapabilitiesForRoles } from "@functions/api/v1/capabilities/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { signServiceToken, signUserClaim } from "@functions/lib/gateway-crypto";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCapabilitiesGet } from "../actions/capabilities-get";
import { onRequestPost, REGISTRY, SUPPORTED_ACTIONS } from "../index";

vi.mock("@functions/api/v1/learning-paths/queries", () => ({
  getActiveLearningTrack: vi.fn(),
}));

vi.mock("@functions/api/v1/capabilities/queries", () => ({
  getUserCapabilitiesForRoles: vi.fn(),
}));

vi.mock("@functions/lib/supabase", () => ({
  createServiceSupabase: vi.fn(() => ({ mockClient: true })),
}));

const SECRET = "test-gateway-secret-that-is-at-least-32-chars";
const APP = "skillpassport";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const URL = "http://lte.test/api/internal/skillpassport";

const env = {
  SKILLPASSPORT_INTERNAL_SECRET: SECRET,
  LTE_PUBLIC_URL: "https://lte.test",
} as unknown as LteEnv;

async function buildRequest(
  body: unknown,
  opts: { app?: string; actions?: string[]; claim?: boolean } = {},
): Promise<Request> {
  const now = Math.floor(Date.now() / 1000);
  const token = await signServiceToken(SECRET, {
    app: opts.app ?? APP,
    actions: opts.actions ?? ["capabilities:get"],
    iat: now,
    exp: now + 300,
  });
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (opts.claim !== false) {
    const { claim, sig } = await signUserClaim(SECRET, USER_ID);
    headers["X-Lte-Claim"] = claim;
    headers["X-Lte-Sig"] = sig;
  }
  return new Request(URL, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function context(request: Request): PagesContext<LteEnv> {
  return { request, env } as unknown as PagesContext<LteEnv>;
}

describe("SkillPassport internal gateway registry", () => {
  it("registers capabilities:get and derives supported actions from it", () => {
    expect(SUPPORTED_ACTIONS).toEqual(["capabilities:get"]);
    expect(REGISTRY["capabilities:get"]).toBe(handleCapabilitiesGet);
  });
});

describe("onRequestPost pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveLearningTrack).mockResolvedValue(null);
  });

  it("rejects requests without a bearer token", async () => {
    const request = new Request(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "capabilities:get", requestId: "r1", payload: {} }),
    });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects service tokens from an unapproved caller app", async () => {
    const request = await buildRequest(
      { action: "capabilities:get", requestId: "r1", payload: { userId: USER_ID } },
      { app: "other-app" },
    );

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", message: "Caller app is not authorized" },
    });
  });

  it("rejects requests without a valid per-user claim", async () => {
    const request = await buildRequest(
      { action: "capabilities:get", requestId: "r1", payload: { userId: USER_ID } },
      { claim: false },
    );

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects a tampered per-user claim", async () => {
    const request = await buildRequest(
      { action: "capabilities:get", requestId: "r1", payload: { userId: USER_ID } },
      { claim: false },
    );
    request.headers.set("X-Lte-Claim", "dGFtcGVyZWQ=");
    request.headers.set("X-Lte-Sig", "c2ln");

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects a malformed JSON body", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signServiceToken(SECRET, {
      app: APP,
      actions: ["capabilities:get"],
      iat: now,
      exp: now + 300,
    });
    const { claim, sig } = await signUserClaim(SECRET, USER_ID);
    const request = new Request(URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Lte-Claim": claim,
        "X-Lte-Sig": sig,
        "Content-Type": "application/json",
      },
      body: "{not-json",
    });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST", message: "Request body must be valid JSON" },
    });
  });

  it("rejects envelopes that fail schema validation", async () => {
    const request = await buildRequest({ action: "", requestId: "r1", payload: {} });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid request envelope" },
    });
  });

  it("rejects actions the service token is not granted", async () => {
    const request = await buildRequest(
      { action: "capabilities:get", requestId: "r1", payload: { userId: USER_ID } },
      { actions: ["other:action"] },
    );

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", message: "Caller not granted action: capabilities:get" },
    });
  });

  it("returns 404 for unknown actions even when granted", async () => {
    const request = await buildRequest(
      { action: "unknown:action", requestId: "r1", payload: {} },
      { actions: ["unknown:action"] },
    );

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_ACTION", message: "Unknown action: unknown:action" },
    });
  });

  it("dispatches a granted action and returns its success envelope", async () => {
    vi.mocked(getActiveLearningTrack).mockResolvedValue({
      id: "track-1",
      roles: [{ roleId: "role-1", roleName: "AI Engineer" }],
    } as never);
    vi.mocked(getUserCapabilitiesForRoles).mockResolvedValue([
      {
        id: "cap-1",
        name: "Voice AI",
        description: "Build voice agents",
        code: "voice-ai",
        status: "in_progress",
        currentLevel: 2,
        totalLevels: 5,
        progress: 40,
        durationHours: 12,
      },
    ]);

    const request = await buildRequest({
      action: "capabilities:get",
      requestId: "req-42",
      payload: { userId: USER_ID },
    });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-ID")).toBe("req-42");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      requestId: "req-42",
      data: {
        capabilities: [
          {
            id: "cap-1",
            code: "voice-ai",
            resumeUrl: expect.stringContaining("/my-courses/voice-ai"),
          },
        ],
      },
    });
  });

  it("maps handler failures to a 500 INTERNAL_ERROR", async () => {
    vi.mocked(getActiveLearningTrack).mockRejectedValue(new Error("db down"));

    const request = await buildRequest({
      action: "capabilities:get",
      requestId: "req-43",
      payload: { userId: USER_ID },
    });

    const response = await onRequestPost(context(request));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Internal gateway error" },
    });
  });
});
