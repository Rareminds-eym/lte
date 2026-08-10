import type { SupabaseClient } from "@supabase/supabase-js";
import { apiLogger } from "../shared/logger";
import { awardXp } from "./xp-engine.core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Counts the number of **consecutive** calendar days (going backwards from today)
 * that appear in the provided sorted-descending date list.
 *
 * e.g. today=2026-08-06, dates=["2026-08-06","2026-08-05","2026-08-03"] → 2
 */
export function countConsecutiveDaysFromToday(todayStr: string, sortedDescDates: string[]): number {
  let consecutive = 0;
  let expected = todayStr;

  for (const d of sortedDescDates) {
    if (d === expected) {
      consecutive++;
      // Move expected one day earlier
      const dt = new Date(`${expected}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() - 1);
      expected = dt.toISOString().split("T")[0] || "";
    } else if (d < expected) {
      // Gap detected — streak is broken
      break;
    }
    // d > expected means duplicate dates (shouldn't happen with DISTINCT but safe to skip)
  }
  return consecutive;
}

// ---------------------------------------------------------------------------
// Daily Login (base)
// ---------------------------------------------------------------------------

/**
 * Awards daily active login XP (+1 engagement).
 * Idempotency key: login:{userId}:{YYYY-MM-DD}
 */
export async function triggerDailyLogin(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ success: boolean; xpAwarded: number }> {
  const todayDate = new Date().toISOString().split("T")[0] || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayDate)) {
    throw new Error("Invalid date format generated");
  }

  const xpResult = await awardXp(supabase, userId, "daily_login", "users", userId, {
    login_date: todayDate,
  });

  return { success: true, xpAwarded: xpResult.xpAwarded };
}

// ---------------------------------------------------------------------------
// Profile Completion
// ---------------------------------------------------------------------------

/**
 * Awards profile completion XP (+50 engagement, once per user lifetime).
 * Idempotency key: profile:{userId}
 */
export async function completeProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ success: boolean; xpAwarded: number }> {
  const xpRes = await awardXp(supabase, userId, "profile_completed", "users", userId);
  return { success: true, xpAwarded: xpRes.xpAwarded };
}

// ---------------------------------------------------------------------------
// Streak — rolling 7-consecutive-day window
// ---------------------------------------------------------------------------

/**
 * Checks the user's rolling login streak and awards +5 XP for every
 * 7th consecutive login day (7, 14, 21, ...).
 *
 * Idempotency key: streak7:{userId}:{YYYY-MM-DD}  (the day the milestone lands on)
 * Streak resets to 0 when any calendar day is missed.
 */
export async function checkAndAwardStreak(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ xpAwarded: number; consecutiveDays: number }> {
  const todayStr = new Date().toISOString().split("T")[0] || "";

  // Fetch all distinct daily_login dates for this user, descending
  const { data: loginRows, error } = await supabase
    .from("xp_events")
    .select("metadata")
    .eq("user_id", userId)
    .eq("event_type", "daily_login");

  if (error) throw error;

  // Extract and deduplicate YYYY-MM-DD strings from metadata.login_date
  const dateSet = new Set<string>();
  for (const row of loginRows ?? []) {
    const meta = row.metadata;
    const isObject = meta !== null && typeof meta === "object" && !Array.isArray(meta);
    const d =
      isObject && typeof (meta as Record<string, unknown>)["login_date"] === "string"
        ? ((meta as Record<string, unknown>)["login_date"] as string)
        : null;
    if (d) dateSet.add(d);
  }

  // Sort descending
  const sortedDates = Array.from(dateSet).sort((a, b) => (a > b ? -1 : 1));

  const consecutive = countConsecutiveDaysFromToday(todayStr, sortedDates);

  // Award on every multiple of 7
  if (consecutive > 0 && consecutive % 7 === 0) {
    const res = await awardXp(supabase, userId, "streak_7_day", "xp_events", userId, {
      consecutive_days: consecutive,
      streak_milestone: consecutive / 7,
      streak_date: todayStr,
    });
    return { xpAwarded: res.xpAwarded, consecutiveDays: consecutive };
  }

  return { xpAwarded: 0, consecutiveDays: consecutive };
}

// ---------------------------------------------------------------------------
// 30-day Consistency — 30 consecutive calendar days
// ---------------------------------------------------------------------------

/**
 * Checks whether the user has logged in for 30 consecutive calendar days
 * and awards +30 XP if so.
 *
 * Idempotency key: consistency30:{userId}:{YYYY-MM-DD}  (the 30th consecutive day)
 * A new award is possible if the user breaks and rebuilds a new 30-day streak.
 */
export async function checkAndAwardConsistency(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ xpAwarded: number; consecutiveDays: number }> {
  const todayStr = new Date().toISOString().split("T")[0] || "";

  const { data: loginRows, error } = await supabase
    .from("xp_events")
    .select("metadata")
    .eq("user_id", userId)
    .eq("event_type", "daily_login");

  if (error) throw error;

  const dateSet = new Set<string>();
  for (const row of loginRows ?? []) {
    const meta = row.metadata;
    const isObject = meta !== null && typeof meta === "object" && !Array.isArray(meta);
    const d =
      isObject && typeof (meta as Record<string, unknown>)["login_date"] === "string"
        ? ((meta as Record<string, unknown>)["login_date"] as string)
        : null;
    if (d) dateSet.add(d);
  }

  const sortedDates = Array.from(dateSet).sort((a, b) => (a > b ? -1 : 1));
  const consecutive = countConsecutiveDaysFromToday(todayStr, sortedDates);

  if (consecutive >= 30) {
    const startDt = new Date(`${todayStr}T00:00:00Z`);
    startDt.setUTCDate(startDt.getUTCDate() - (consecutive - 1));
    const streakStartDate = startDt.toISOString().split("T")[0] || "";

    const res = await awardXp(supabase, userId, "consistency_30_day", "xp_events", userId, {
      consecutive_days: consecutive,
      streak_start: streakStartDate,
      consistency_date: todayStr,
    });
    return { xpAwarded: res.xpAwarded, consecutiveDays: consecutive };
  }

  return { xpAwarded: 0, consecutiveDays: consecutive };
}

// ---------------------------------------------------------------------------
// Legacy Consistency Bonus — returning after >4 months of absence
// ---------------------------------------------------------------------------

/**
 * Checks whether the user is returning after more than 120 days of inactivity.
 * Awards +20 XP once per calendar year when the condition is met.
 *
 * Idempotency key: legacy_bonus:{userId}:{YYYY}
 * Source: users.last_activity_at (updated by sync-shadow on every login/sync)
 */
export async function checkAndAwardLegacyBonus(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ xpAwarded: number; gapDays: number }> {
  const { data: userRow, error } = await supabase
    .from("users")
    .select("last_activity_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!userRow?.last_activity_at) return { xpAwarded: 0, gapDays: 0 };

  const lastActivity = new Date(userRow.last_activity_at);
  const now = new Date();
  const gapMs = now.getTime() - lastActivity.getTime();
  const gapDays = Math.floor(gapMs / (1000 * 60 * 60 * 24));

  if (gapDays > 120) {
    const res = await awardXp(supabase, userId, "legacy_consistency_bonus", "users", userId, {
      gap_days: gapDays,
      last_activity_at: userRow.last_activity_at,
    });
    return { xpAwarded: res.xpAwarded, gapDays };
  }

  return { xpAwarded: 0, gapDays };
}

// ---------------------------------------------------------------------------
// Readiness Milestones
// ---------------------------------------------------------------------------

/**
 * Evaluates readiness milestones based on score and awards engagement XP.
 * Idempotency keys: milestone25/50/75/100:{userId}:{roleId}
 */
export async function evaluateMilestones(
  supabase: SupabaseClient,
  userId: string,
  roleId: string,
  readinessScore: number,
): Promise<{ success: boolean; milestonesAwarded: string[] }> {
  const thresholds = [
    { score: 25, event: "readiness_milestone_25" },
    { score: 50, event: "readiness_milestone_50" },
    { score: 75, event: "readiness_milestone_75" },
    { score: 100, event: "readiness_milestone_100" },
  ];

  const awarded: string[] = [];

  for (const t of thresholds) {
    if (readinessScore >= t.score) {
      const res = await awardXp(supabase, userId, t.event, "roles", roleId);
      if (!res.alreadyAwarded && res.xpAwarded > 0) {
        awarded.push(t.event);
      }
    }
  }

  return { success: true, milestonesAwarded: awarded };
}

// ---------------------------------------------------------------------------
// Composite: Full daily login engagement trigger
// ---------------------------------------------------------------------------

export interface DailyLoginEngagementResult {
  dailyXp: number;
  streakXp: number;
  consistencyXp: number;
  legacyBonusXp: number;
  totalXp: number;
  consecutiveDays: number;
}

/**
 * Master engagement trigger to call on every login (SSO exchange + token refresh).
 *
 * Runs all engagement checks in sequence and returns an aggregate breakdown.
 * This function is designed to be called fire-and-forget — all errors are caught
 * and logged internally so they never fail the parent auth response.
 */
export async function triggerDailyLoginWithEngagement(
  supabase: SupabaseClient,
  userId: string,
): Promise<DailyLoginEngagementResult> {
  let dailyXp = 0;
  let streakXp = 0;
  let consistencyXp = 0;
  let legacyBonusXp = 0;
  let consecutiveDays = 0;

  // 1. Award daily login XP (+1)
  try {
    const res = await triggerDailyLogin(supabase, userId);
    dailyXp = res.xpAwarded;
  } catch (err) {
    apiLogger.error("[XP] daily_login failed", err, { userId });
  }

  // 2. Check and award 7-day streak bonus (+5 per 7 consecutive days)
  try {
    const res = await checkAndAwardStreak(supabase, userId);
    streakXp = res.xpAwarded;
    consecutiveDays = res.consecutiveDays;
  } catch (err) {
    apiLogger.error("[XP] streak check failed", err, { userId });
  }

  // 3. Check and award 30-day consistency bonus (+30 at 30 consecutive days)
  try {
    const res = await checkAndAwardConsistency(supabase, userId);
    consistencyXp = res.xpAwarded;
    if (res.consecutiveDays > consecutiveDays) consecutiveDays = res.consecutiveDays;
  } catch (err) {
    apiLogger.error("[XP] consistency check failed", err, { userId });
  }

  // 4. Check and award legacy re-engagement bonus (+20, once per year after >120 day gap)
  try {
    const res = await checkAndAwardLegacyBonus(supabase, userId);
    legacyBonusXp = res.xpAwarded;
  } catch (err) {
    apiLogger.error("[XP] legacy bonus check failed", err, { userId });
  }

  const totalXp = dailyXp + streakXp + consistencyXp + legacyBonusXp;

  apiLogger.info("[XP] daily login engagement complete", {
    userId,
    dailyXp,
    streakXp,
    consistencyXp,
    legacyBonusXp,
    totalXp,
    consecutiveDays,
  });

  return { dailyXp, streakXp, consistencyXp, legacyBonusXp, totalXp, consecutiveDays };
}

// ---------------------------------------------------------------------------
// XP Summary
// ---------------------------------------------------------------------------

/**
 * Calculates the total XP for a user from the xp_events table.
 * Optionally filters to events created at or after `since`.
 */
export async function getUserTotalXp(
  supabase: SupabaseClient,
  userId: string,
  since?: Date,
): Promise<number> {
  let query = supabase.from("xp_events").select("xp_amount").eq("user_id", userId);

  if (since) {
    query = query.gte("created_at", since.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((sum, item) => sum + (item.xp_amount ?? 0), 0);
}
