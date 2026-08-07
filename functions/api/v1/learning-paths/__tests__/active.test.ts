import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../active";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

interface Chainable extends Record<string, unknown> {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: (onfulfilled: unknown) => unknown;
}

function chainable(resolveVal: unknown = null, errorVal: unknown = null) {
  const chain: Chainable = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
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
    const mockSupabase = {
      from: vi.fn().mockReturnValue(chainable(null)),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeNull();
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
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);
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
