import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
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
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function chainable(terminal: Record<string, unknown> = {}) {
  const chain: Chainable = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return Object.assign(chain, terminal);
}

describe("GET /api/v1/learning-paths/active", () => {
  const mockUser = {
    sub: "user-uuid-1234",
    email: "learner@rareminds.com",
    products: ["lte"],
    roles: ["learner"],
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
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser as never);
    const mockSupabase = {
      from: vi
        .fn()
        .mockReturnValue(
          chainable({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        ),
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
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser as never);
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "learning_paths") {
          return chainable({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "path-1",
                learning_track_id: "track-1",
                role_id: "role-1",
                is_active: true,
                learning_tracks: { track: "Frontend", fit: "Strong", match_score: 85 },
              },
              error: null,
            }),
          });
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
    expect(body.data.learningPathId).toBe("path-1");
    expect(body.data.track).toBe("Frontend");
  });
});
