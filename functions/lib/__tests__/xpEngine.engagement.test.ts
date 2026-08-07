import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAndAwardConsistency,
  checkAndAwardLegacyBonus,
  checkAndAwardStreak,
  completeProfile,
  countConsecutiveDaysFromToday,
  evaluateMilestones,
  triggerDailyLogin,
  triggerDailyLoginWithEngagement,
} from "../xp-engine.engagement";
import { createMockQueryChain, mockInsert, mockSupabase, resetMocks } from "./xpEngine.helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDateStr(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split("T")[0] as string;
}

function makeLoginRows(daysAgo: number[]): { metadata: { login_date: string } }[] {
  return daysAgo.map((n) => ({ metadata: { login_date: makeDateStr(n) } }));
}

// ---------------------------------------------------------------------------
// countConsecutiveDaysFromToday (pure utility)
// ---------------------------------------------------------------------------

describe("countConsecutiveDaysFromToday", () => {
  it("returns 0 when no dates match today", () => {
    const today = "2026-08-06";
    expect(countConsecutiveDaysFromToday(today, ["2026-08-04", "2026-08-03"])).toBe(0);
  });

  it("counts one date (today only)", () => {
    const today = "2026-08-06";
    expect(countConsecutiveDaysFromToday(today, ["2026-08-06"])).toBe(1);
  });

  it("counts 3 consecutive days ending today", () => {
    const today = "2026-08-06";
    const dates = ["2026-08-06", "2026-08-05", "2026-08-04", "2026-08-01"];
    expect(countConsecutiveDaysFromToday(today, dates)).toBe(3);
  });

  it("stops at the first gap", () => {
    const today = "2026-08-06";
    const dates = ["2026-08-06", "2026-08-05", "2026-08-03"]; // gap at 08-04
    expect(countConsecutiveDaysFromToday(today, dates)).toBe(2);
  });

  it("handles empty array", () => {
    expect(countConsecutiveDaysFromToday("2026-08-06", [])).toBe(0);
  });

  it("handles duplicate dates gracefully", () => {
    const today = "2026-08-06";
    const dates = ["2026-08-06", "2026-08-06", "2026-08-05"];
    // Duplicates should be eliminated before calling, but the function is safe
    expect(countConsecutiveDaysFromToday(today, dates)).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// triggerDailyLogin
// ---------------------------------------------------------------------------

describe("triggerDailyLogin", () => {
  beforeEach(() => resetMocks());

  it("awards +1 daily login XP with today's date as sourceId", async () => {
    mockInsert.mockReturnValueOnce({ error: null });

    const result = await triggerDailyLogin(mockSupabase, "user-1");

    expect(result).toEqual({ success: true, xpAwarded: 1 });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "daily_login",
        source_type: "users",
        xp_amount: 1,
        metadata: { login_date: expect.any(String) },
      }),
    );
  });

  it("returns xpAwarded: 0 when login already recorded today (idempotent)", async () => {
    mockInsert.mockReturnValueOnce({ error: { code: "23505", message: "duplicate key" } });

    const result = await triggerDailyLogin(mockSupabase, "user-1");

    expect(result).toEqual({ success: true, xpAwarded: 0 });
  });
});

// ---------------------------------------------------------------------------
// completeProfile
// ---------------------------------------------------------------------------

describe("completeProfile", () => {
  beforeEach(() => resetMocks());

  it("awards +50 profile completion XP once", async () => {
    mockInsert.mockReturnValueOnce({ error: null });

    const result = await completeProfile(mockSupabase, "user-1");

    expect(result).toEqual({ success: true, xpAwarded: 50 });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "profile_completed",
        xp_amount: 50,
        idempotency_key: "profile:user-1",
      }),
    );
  });

  it("returns xpAwarded: 0 when already awarded (idempotent)", async () => {
    mockInsert.mockReturnValueOnce({ error: { code: "23505", message: "duplicate key" } });

    const result = await completeProfile(mockSupabase, "user-1");

    expect(result).toEqual({ success: true, xpAwarded: 0 });
  });
});

// ---------------------------------------------------------------------------
// checkAndAwardStreak
// ---------------------------------------------------------------------------

describe("checkAndAwardStreak", () => {
  function createStreakMock(loginRows: unknown[], insertError: unknown = null) {
    const insert = vi.fn().mockReturnValue({ error: insertError });
    return {
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "xp_events") {
            // First call: select login rows. Second+ calls: insert
            return {
              ...createMockQueryChain(loginRows),
              insert,
            };
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof checkAndAwardStreak>[0],
      insert,
    };
  }

  it("awards +5 streak XP exactly on the 7th consecutive day", async () => {
    const rows = makeLoginRows([0, 1, 2, 3, 4, 5, 6]); // 7 consecutive days incl. today
    const { supabase, insert } = createStreakMock(rows);

    const result = await checkAndAwardStreak(supabase, "user-1");

    expect(result.xpAwarded).toBe(5);
    expect(result.consecutiveDays).toBe(7);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "streak_7_day",
        xp_amount: 5,
        metadata: expect.objectContaining({ consecutive_days: 7, streak_milestone: 1 }),
      }),
    );
  });

  it("awards +5 streak XP on the 14th consecutive day (2nd milestone)", async () => {
    const rows = makeLoginRows([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const { supabase } = createStreakMock(rows);

    const result = await checkAndAwardStreak(supabase, "user-1");

    expect(result.xpAwarded).toBe(5);
    expect(result.consecutiveDays).toBe(14);
  });

  it("does NOT award on day 6 (streak not yet complete)", async () => {
    const rows = makeLoginRows([0, 1, 2, 3, 4, 5]); // only 6 days
    const { supabase } = createStreakMock(rows);

    const result = await checkAndAwardStreak(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
    expect(result.consecutiveDays).toBe(6);
  });

  it("does NOT award when streak is broken (gap yesterday)", async () => {
    // Today + 5 days ago to 8 days ago — missing yesterday and day before
    const rows = makeLoginRows([0, 5, 6, 7, 8, 9, 10]);
    const { supabase } = createStreakMock(rows);

    const result = await checkAndAwardStreak(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
    expect(result.consecutiveDays).toBe(1); // only today is consecutive
  });

  it("returns xpAwarded: 0 when streak already awarded this cycle (idempotent)", async () => {
    const rows = makeLoginRows([0, 1, 2, 3, 4, 5, 6]);
    const { supabase } = createStreakMock(rows, { code: "23505", message: "duplicate key" });

    const result = await checkAndAwardStreak(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
  });

  it("returns 0 when no login history exists", async () => {
    const { supabase } = createStreakMock([]);

    const result = await checkAndAwardStreak(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
    expect(result.consecutiveDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkAndAwardConsistency
// ---------------------------------------------------------------------------

describe("checkAndAwardConsistency", () => {
  function createConsistencyMock(loginRows: unknown[], insertError: unknown = null) {
    const insert = vi.fn().mockReturnValue({ error: insertError });
    return {
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "xp_events") {
            return {
              ...createMockQueryChain(loginRows),
              insert,
            };
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof checkAndAwardConsistency>[0],
      insert,
    };
  }

  it("awards +30 consistency XP at exactly 30 consecutive days", async () => {
    const rows = makeLoginRows(Array.from({ length: 30 }, (_, i) => i)); // days 0-29
    const { supabase, insert } = createConsistencyMock(rows);

    const result = await checkAndAwardConsistency(supabase, "user-1");

    expect(result.xpAwarded).toBe(30);
    expect(result.consecutiveDays).toBe(30);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "consistency_30_day",
        xp_amount: 30,
        metadata: expect.objectContaining({ consecutive_days: 30 }),
      }),
    );
  });

  it("awards +30 XP at 45 consecutive days (streak still active)", async () => {
    const rows = makeLoginRows(Array.from({ length: 45 }, (_, i) => i));
    const { supabase } = createConsistencyMock(rows);

    const result = await checkAndAwardConsistency(supabase, "user-1");

    expect(result.xpAwarded).toBe(30);
    expect(result.consecutiveDays).toBe(45);
  });

  it("does NOT award at 29 consecutive days", async () => {
    const rows = makeLoginRows(Array.from({ length: 29 }, (_, i) => i));
    const { supabase } = createConsistencyMock(rows);

    const result = await checkAndAwardConsistency(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
    expect(result.consecutiveDays).toBe(29);
  });

  it("does NOT award when there is a gap in the streak", async () => {
    // 15 days + gap + 15 more = not 30 consecutive
    const part1 = makeLoginRows(Array.from({ length: 15 }, (_, i) => i));
    const part2 = makeLoginRows(Array.from({ length: 15 }, (_, i) => i + 17));
    const { supabase } = createConsistencyMock([...part1, ...part2]);

    const result = await checkAndAwardConsistency(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
    expect(result.consecutiveDays).toBe(15);
  });

  it("returns xpAwarded: 0 when already awarded for this streak (idempotent)", async () => {
    const rows = makeLoginRows(Array.from({ length: 30 }, (_, i) => i));
    const { supabase } = createConsistencyMock(rows, { code: "23505", message: "duplicate key" });

    const result = await checkAndAwardConsistency(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkAndAwardLegacyBonus
// ---------------------------------------------------------------------------

describe("checkAndAwardLegacyBonus", () => {
  function createLegacyMock(lastActivityAt: string | null, insertError: unknown = null) {
    const insert = vi.fn().mockReturnValue({ error: insertError });
    return {
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "users") {
            return createMockQueryChain(
              lastActivityAt ? { last_activity_at: lastActivityAt } : null,
            );
          }
          if (table === "xp_events") {
            return { insert };
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof checkAndAwardLegacyBonus>[0],
      insert,
    };
  }

  it("awards +20 XP when last activity was 121 days ago", async () => {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - 121);
    const { supabase, insert } = createLegacyMock(dt.toISOString());

    const result = await checkAndAwardLegacyBonus(supabase, "user-1");

    expect(result.xpAwarded).toBe(20);
    expect(result.gapDays).toBeGreaterThanOrEqual(121);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "legacy_consistency_bonus",
        xp_amount: 20,
        // idempotency key includes the year
        idempotency_key: expect.stringMatching(/^legacy_bonus:user-1:\d{4}$/),
      }),
    );
  });

  it("does NOT award when last activity was only 30 days ago", async () => {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - 30);
    const { supabase, insert } = createLegacyMock(dt.toISOString());

    const result = await checkAndAwardLegacyBonus(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it("does NOT award when last activity was exactly 120 days ago (boundary)", async () => {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - 120);
    const { supabase } = createLegacyMock(dt.toISOString());

    const result = await checkAndAwardLegacyBonus(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
  });

  it("returns xpAwarded: 0 when already awarded this year (idempotent)", async () => {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - 200);
    const { supabase } = createLegacyMock(dt.toISOString(), {
      code: "23505",
      message: "duplicate key",
    });

    const result = await checkAndAwardLegacyBonus(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
  });

  it("returns 0 when user row is missing", async () => {
    const { supabase } = createLegacyMock(null);

    const result = await checkAndAwardLegacyBonus(supabase, "user-1");

    expect(result.xpAwarded).toBe(0);
    expect(result.gapDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateMilestones
// ---------------------------------------------------------------------------

describe("evaluateMilestones", () => {
  beforeEach(() => resetMocks());

  it("awards all four milestones for a perfect score of 100", async () => {
    const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 100);

    expect(result).toEqual({
      success: true,
      milestonesAwarded: [
        "readiness_milestone_25",
        "readiness_milestone_50",
        "readiness_milestone_75",
        "readiness_milestone_100",
      ],
    });
  });

  it("awards only milestones at or below the score", async () => {
    const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 60);

    expect(result.milestonesAwarded).toEqual(["readiness_milestone_25", "readiness_milestone_50"]);
  });

  it("awards nothing below score 25", async () => {
    const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 10);

    expect(result.milestonesAwarded).toEqual([]);
  });

  it("awards only the 25% milestone at exactly score 25", async () => {
    const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 25);

    expect(result.milestonesAwarded).toEqual(["readiness_milestone_25"]);
  });

  it("does not re-award milestones that were already granted (idempotent)", async () => {
    mockInsert.mockReturnValue({
      error: { code: "23505", message: "duplicate key" },
    });

    const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 100);

    expect(result.milestonesAwarded).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// triggerDailyLoginWithEngagement (composite)
// ---------------------------------------------------------------------------

describe("triggerDailyLoginWithEngagement", () => {
  function createCompositeMock(opts: {
    loginRows: unknown[];
    lastActivityAt: string | null;
    insertErrors?: (unknown | null)[];
  }) {
    let insertCallCount = 0;
    const insertErrors = opts.insertErrors ?? [];
    const insert = vi.fn().mockImplementation(() => {
      const err = insertErrors[insertCallCount] ?? null;
      insertCallCount++;
      return { error: err };
    });

    return {
      supabase: {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "xp_events") {
            return {
              ...createMockQueryChain(opts.loginRows),
              insert,
            };
          }
          if (table === "users") {
            return createMockQueryChain(
              opts.lastActivityAt ? { last_activity_at: opts.lastActivityAt } : null,
            );
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof triggerDailyLoginWithEngagement>[0],
      insert,
    };
  }

  it("returns a full breakdown on first login of a new user", async () => {
    const { supabase } = createCompositeMock({
      loginRows: [],
      lastActivityAt: null,
    });

    const result = await triggerDailyLoginWithEngagement(supabase, "user-1");

    expect(result.dailyXp).toBe(1);
    expect(result.streakXp).toBe(0);
    expect(result.consistencyXp).toBe(0);
    expect(result.legacyBonusXp).toBe(0);
    expect(result.totalXp).toBe(1);
  });

  it("awards streak XP on the 7th consecutive day login", async () => {
    const rows = makeLoginRows([0, 1, 2, 3, 4, 5, 6]);
    const { supabase } = createCompositeMock({
      loginRows: rows,
      lastActivityAt: null,
      // daily_login already inserted, streak_7_day succeeds
      insertErrors: [{ code: "23505" }, null],
    });

    const result = await triggerDailyLoginWithEngagement(supabase, "user-1");

    expect(result.streakXp).toBe(5);
    expect(result.totalXp).toBe(5); // daily was duplicate (0) + streak (5)
  });

  it("awards legacy bonus XP when returning after >120 day gap", async () => {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - 150);
    const { supabase } = createCompositeMock({
      loginRows: [],
      lastActivityAt: dt.toISOString(),
      insertErrors: [null, null], // daily: success, legacy: success
    });

    const result = await triggerDailyLoginWithEngagement(supabase, "user-1");

    expect(result.dailyXp).toBe(1);
    expect(result.legacyBonusXp).toBe(20);
    expect(result.totalXp).toBe(21);
  });

  it("returns totalXp: 0 when all events are already awarded (full idempotency)", async () => {
    const dupError = { code: "23505", message: "duplicate key" };
    const rows = makeLoginRows([0, 1, 2, 3, 4, 5, 6]);
    const { supabase } = createCompositeMock({
      loginRows: rows,
      lastActivityAt: null,
      insertErrors: [dupError, dupError, dupError, dupError],
    });

    const result = await triggerDailyLoginWithEngagement(supabase, "user-1");

    expect(result.totalXp).toBe(0);
  });
});
