import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { getUserTotalXp } from "@functions/lib/xp-engine";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../xp";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

vi.mock("@functions/lib/xp-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/xp-engine")>();
  return { ...actual, getUserTotalXp: vi.fn() };
});

describe("GET /api/v1/dashboard/xp", () => {
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
  });

  it("returns the user's total XP, this-week XP, and today XP", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getUserTotalXp)
      .mockResolvedValueOnce(430)
      .mockResolvedValueOnce(75)
      .mockResolvedValueOnce(20);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({} as SupabaseClient);
    const since = "2026-08-03T00:00:00.000Z";
    const todaySince = "2026-08-05T00:00:00.000Z";
    const response = await onRequestGet({
      request: new Request(
        `http://localhost/api/v1/dashboard/xp?since=${encodeURIComponent(since)}&todaySince=${encodeURIComponent(todaySince)}`,
      ),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.totalXp).toBe(430);
    expect(body.xpThisWeek).toBe(75);
    expect(body.todayXp).toBe(20);
    expect(getUserTotalXp).toHaveBeenNthCalledWith(1, expect.anything(), mockUser.sub);
    expect(getUserTotalXp).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      mockUser.sub,
      new Date(since),
    );
    expect(getUserTotalXp).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      mockUser.sub,
      new Date(todaySince),
    );
  });

  it("falls back to UTC boundaries when since is absent or invalid", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getUserTotalXp).mockResolvedValue(0);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({} as SupabaseClient);
    const response = await onRequestGet({
      request: new Request(
        "http://localhost/api/v1/dashboard/xp?since=not-a-date&todaySince=also-bad",
      ),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(200);
    const weekFallback = vi.mocked(getUserTotalXp).mock.calls[1]?.[2];
    expect(weekFallback).toBeInstanceOf(Date);
    expect(weekFallback?.getUTCDay()).toBe(1);
    expect(weekFallback?.getUTCHours()).toBe(0);
    const dayFallback = vi.mocked(getUserTotalXp).mock.calls[2]?.[2];
    expect(dayFallback).toBeInstanceOf(Date);
    expect(dayFallback?.getUTCHours()).toBe(0);
    expect(dayFallback?.getUTCMinutes()).toBe(0);
  });

  it("returns 500 when the XP query fails", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    vi.mocked(getUserTotalXp).mockRejectedValueOnce(new Error("db down"));
    vi.mocked(createServiceSupabase).mockReturnValueOnce({} as SupabaseClient);
    const response = await onRequestGet({
      request: new Request("http://localhost"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);
    expect(response.status).toBe(500);
  });
});
