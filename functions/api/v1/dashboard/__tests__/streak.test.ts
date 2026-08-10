import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import type { AuthUser } from "@rareminds-eym/auth-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../streak";

type StreakQueryMock = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
};
type StreakSupabaseMock = {
  from: ReturnType<typeof vi.fn>;
};

const supabaseMockState = vi.hoisted(() => ({
  current: null as StreakSupabaseMock | null,
}));

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({
  createServiceSupabase: vi.fn(() => supabaseMockState.current),
}));

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
    supabaseMockState.current = null;
  });

  function mockDailyLoginDates(loginDates: string[]): {
    query: StreakQueryMock;
    supabase: StreakSupabaseMock;
  } {
    const query: StreakQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({
      data: loginDates.map((loginDate) => ({ metadata: { login_date: loginDate } })),
      error: null,
    });

    const supabase: StreakSupabaseMock = {
      from: vi.fn().mockReturnValue(query),
    };
    supabaseMockState.current = supabase;

    return { query, supabase };
  }

  function toDateString(date: Date): string {
    const dateString = date.toISOString().split("T")[0];
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new Error("Invalid test date generated");
    }
    return dateString;
  }

  function daysBeforeToday(days: number): string {
    const today = toDateString(new Date());
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days);
    return toDateString(date);
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
    const { query, supabase } = mockDailyLoginDates([
      daysBeforeToday(0),
      daysBeforeToday(1),
      daysBeforeToday(3),
    ]);

    const response = await onRequestGet({
      request: new Request("http://localhost/api/v1/dashboard/streak"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("xp_events");
    expect(query.select).toHaveBeenCalledWith("metadata");
    expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", mockUser.sub);
    expect(query.eq).toHaveBeenNthCalledWith(2, "event_type", "daily_login");
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

  it("ignores malformed login dates when calculating the current streak", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    mockDailyLoginDates([daysBeforeToday(0), "bad-date", daysBeforeToday(1)]);

    const response = await onRequestGet({
      request: new Request("http://localhost/api/v1/dashboard/streak"),
      env: {} as LteEnv,
    } as PagesContext<LteEnv>);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, streakDays: 2 });
  });
});
