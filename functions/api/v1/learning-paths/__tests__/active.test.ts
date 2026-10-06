import { createQueryGateway, createServiceQueryGateway } from "@functions/lib/query-gateway";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, checkDistributedRateLimit, requireAuth } from "@functions/middleware";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../active";

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: vi.fn(), checkDistributedRateLimit: vi.fn() };
});

vi.mock("@functions/lib/query-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/query-gateway")>();
  return { ...actual, createServiceQueryGateway: vi.fn() };
});

vi.mock("@functions/lib/skill-gateway", () => ({ callSkill: vi.fn() }));

interface Chainable extends Record<string, unknown> {
  upsert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: (onfulfilled: unknown) => unknown;
}

function chainable(resolveVal: unknown = null, errorVal: unknown = null) {
  const chain: Chainable = {
    upsert: vi.fn().mockImplementation(() => chain),
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    gte: vi.fn().mockImplementation(() => chain),
    range: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: vi
      .fn()
      .mockImplementation((onfulfilled) =>
        Promise.resolve({ data: resolveVal, error: errorVal }).then(onfulfilled),
      ),
  };
  return chain;
}

describe("GET /api/v1/learning-paths/active", () => {
  const mockUser: AuthUser = {
    sub: "user-uuid-1234",
    email: "learner@rareminds.com",
    org_id: "org-1",
    roles: ["learner"],
    products: ["lte"],
    membership_status: "active",
    is_email_verified: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(callSkill).mockResolvedValue({ found: false });
  });

  function gatewayFromSupabase(mockSupabase: { from: ReturnType<typeof vi.fn> }) {
    return createQueryGateway(mockSupabase as unknown as SupabaseClient);
  }

  it("rejects an invalid refresh before creating a gateway or touching upstream data", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const response = await onRequestGet({
      request: new Request("https://lte.test/api/v1/learning-paths/active?refresh=yes"),
      env: {},
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(400);
    expect(createServiceQueryGateway).not.toHaveBeenCalled();
    expect(callSkill).not.toHaveBeenCalled();
  });
  it("limits explicit refreshes before database writes or upstream calls", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(checkDistributedRateLimit).mockResolvedValueOnce({
      allowed: false,
      retryAfterMs: 1500,
    });
    const from = vi.fn();

    const response = await onRequestGet({
      request: new Request("https://lte.test/api/v1/learning-paths/active?refresh=true"),
      env: {},
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(from).not.toHaveBeenCalled();
    expect(createServiceQueryGateway).not.toHaveBeenCalled();
    expect(callSkill).not.toHaveBeenCalled();
  });

  it("returns a sanitized 503 when KV cannot record a refresh", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(checkDistributedRateLimit).mockRejectedValueOnce(new Error("private KV detail"));
    const response = await onRequestGet({
      request: new Request("https://lte.test/api/v1/learning-paths/active?refresh=true"),
      env: {},
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private KV detail");
    expect(createServiceQueryGateway).not.toHaveBeenCalled();
  });
  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns null data when no active path", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const userChain = chainable(null);
    const mockSupabase = {
      from: vi.fn((table: string) => (table === "users" ? userChain : chainable(null))),
    };
    vi.mocked(createServiceQueryGateway).mockReturnValueOnce(gatewayFromSupabase(mockSupabase));
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.needsAssessment).toBe(true);
    expect(userChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: mockUser.sub, email: mockUser.email }),
      expect.objectContaining({ onConflict: "id" }),
    );
  });

  it("returns a retryable error when the assessment gateway fails", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(callSkill).mockRejectedValueOnce(new Error("private upstream details"));
    const userChain = chainable({ id: mockUser.sub });
    const mockSupabase = {
      from: vi.fn((table: string) => (table === "users" ? userChain : chainable(null))),
    };
    vi.mocked(createServiceQueryGateway).mockReturnValueOnce(gatewayFromSupabase(mockSupabase));
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("private upstream details");
    expect(body.needsAssessment).toBeUndefined();
    expect(userChain.upsert).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { found: true, tracks: [] },
  ])("does not ask for an assessment on an invalid gateway response %j", async (payload) => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(callSkill).mockResolvedValueOnce(payload);
    const mockSupabase = {
      from: vi.fn((table: string) => chainable(table === "users" ? { id: mockUser.sub } : null)),
    };
    vi.mocked(createServiceQueryGateway).mockReturnValueOnce(gatewayFromSupabase(mockSupabase));
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(503);
    expect((await response.json()).needsAssessment).toBeUndefined();
  });

  it("returns active path data when one exists", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "learning_tracks") {
          return chainable({
            id: "track-1",
            track: "Frontend",
            fit: "Strong",
            match_score: 85,
            why_it_fits: "Good fit.",
          });
        }
        if (table === "learning_paths") {
          return chainable([
            {
              id: "path-1",
              role_id: "role-1",
              roles: { role_name: "Frontend Engineer" },
            },
          ]);
        }
        return chainable();
      }),
    };
    vi.mocked(createServiceQueryGateway).mockReturnValueOnce(gatewayFromSupabase(mockSupabase));
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.learningTrackId).toBe("track-1");
    expect(body.data.track).toBe("Frontend");
    expect(body.data.roles).toHaveLength(1);
    expect(body.data.roles[0].roleName).toBe("Frontend Engineer");
  });
});
