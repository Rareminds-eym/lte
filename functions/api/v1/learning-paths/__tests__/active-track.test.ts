import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPatch } from "../active-track";
import { activateLearningTrack } from "../queries";

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

vi.mock("../queries", () => ({
  activateLearningTrack: vi.fn(),
}));

describe("PATCH /api/v1/learning-paths/active-track", () => {
  const mockUser: AuthUser = {
    sub: "user-uuid-1234",
    email: "learner@rareminds.com",
    org_id: "org-1",
    roles: ["learner"],
    products: ["lte"],
    membership_status: "active",
    is_email_verified: true,
  };

  const validTrackId = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestPatch({
      request: new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ trackId: validTrackId }),
      }),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 when trackId is missing or invalid", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const response = await onRequestPatch({
      request: new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ trackId: "invalid-uuid" }),
      }),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 on successful activation", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const mockSupabase = {} as unknown as SupabaseClient;
    vi.mocked(createServiceSupabase).mockReturnValueOnce(mockSupabase);
    vi.mocked(activateLearningTrack).mockResolvedValueOnce(undefined);

    const response = await onRequestPatch({
      request: new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ trackId: validTrackId }),
      }),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(activateLearningTrack).toHaveBeenCalledWith(mockSupabase, mockUser.sub, validTrackId);
  });
});
