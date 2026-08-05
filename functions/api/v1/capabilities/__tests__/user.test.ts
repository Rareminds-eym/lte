import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../user";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

interface Chainable extends Record<string, unknown> {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: (resolve: (val: unknown) => unknown) => Promise<unknown>;
}

function chainable(resolveVal: unknown = null, errorVal: unknown = null) {
  const chain: Chainable = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    in: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    single: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    maybeSingle: vi.fn().mockResolvedValue({ data: resolveVal, error: errorVal }),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: vi
      .fn()
      .mockImplementation((resolve) =>
        Promise.resolve({ data: resolveVal, error: errorVal }).then(resolve),
      ),
  };
  return chain;
}

describe("GET /api/v1/capabilities/user", () => {
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

  it("returns empty capabilities when no active learning path", async () => {
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
    expect(body.capabilities).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("returns capabilities for active learning path", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "learning_tracks") {
          return chainable({ id: "track-1", track: "React", fit: "high", match_score: 87 });
        }
        if (table === "learning_paths") {
          return chainable([{ id: "lp-1", role_id: "role-1", roles: { role_name: "Developer" } }]);
        }
        if (table === "role_capability_sequence") {
          return chainable(
            [
              {
                id: "rcs-1",
                sequence_step: 1,
                required_level: "L3",
                capability_priority: "Core",
                capabilities: { id: "cap-1", code: "TEST", name: "Test", description: "Test cap" },
              },
            ],
            null,
          );
        }
        if (table === "levels") {
          const levelsChain: Chainable = {
            select: vi.fn().mockImplementation(() => levelsChain),
            order: vi.fn().mockResolvedValue({ data: null, error: null }),
            eq: vi.fn().mockImplementation(() => levelsChain),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            in: vi
              .fn()
              .mockResolvedValue({ data: [{ capability_id: "cap-1", id: 1 }], error: null }),
            // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
            then: vi
              .fn()
              .mockImplementation((resolve) =>
                Promise.resolve({ data: null, error: null }).then(resolve),
              ),
          };
          return levelsChain;
        }
        return chainable(null);
      }),
    };
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase as unknown as SupabaseClient);
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.capabilities).toHaveLength(1);
    expect(body.count).toBe(1);
  });
});
