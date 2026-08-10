import { AuthError, requireAuth } from "@functions/lib/auth";
import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../streak";

vi.mock("@functions/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/lib/auth")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

describe("GET /api/v1/dashboard/streak", () => {
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

  function mockDailyLoginDates(loginDates: string[]): void {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({
      data: loginDates.map((loginDate) => ({ metadata: { login_date: loginDate } })),
      error: null,
    });

    vi.mocked(createServiceSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient);
  }

  function daysBeforeToday(days: number): string {
    const today = new Date().toISOString().split("T")[0] || "";
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().split("T")[0] || "";
  }

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));

    const response = await onRequestGet({
      request: new Request("http://localhost/api/v1/dashboard/streak"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);

    expect(response.status).toBe(401);
  });

  it("returns the current login streak from daily_login event dates", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    mockDailyLoginDates([daysBeforeToday(0), daysBeforeToday(1), daysBeforeToday(3)]);

    const response = await onRequestGet({
      request: new Request("http://localhost/api/v1/dashboard/streak"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, streakDays: 2 });
  });

  it("resets the current streak to 1 when yesterday is missing", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    mockDailyLoginDates([daysBeforeToday(0), daysBeforeToday(2)]);

    const response = await onRequestGet({
      request: new Request("http://localhost/api/v1/dashboard/streak"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, streakDays: 1 });
  });
});
