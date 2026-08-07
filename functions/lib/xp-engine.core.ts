import type { SupabaseClient } from "@supabase/supabase-js";
import { apiLogger } from "./logger";

// Event to XP amount mapping (TRD-DB-007 enum values)
export const XP_AMOUNTS: Record<string, number> = {
  stage_completed: 1,
  practice_artifact_accepted: 2,
  practice_artifact_failed: 1,
  final_artifact_accepted_1: 20,
  final_artifact_accepted_2: 15,
  final_artifact_accepted_3: 10,
  final_artifact_failed: 1, // +1 per attempt
  manual_eval_accepted: 5, // fallback evaluation pass / manual reviewer accept
  fallback_eval_failed: 1,
  course_completed_on_time: 10,
  fast_track_capability: 15,
  capstone_completed: 0, // Configured/Passed custom
  daily_login: 1,
  profile_completed: 50,
  streak_7_day: 5,
  consistency_30_day: 30,
  readiness_milestone_25: 10,
  readiness_milestone_50: 20,
  readiness_milestone_75: 30,
  readiness_milestone_100: 100,
  legacy_consistency_bonus: 20,
  promotional_xp: 0, // Custom/Configured
};

// Event to category mapping (TRD-DB-007)
export const XP_CATEGORIES: Record<string, "evidence" | "engagement"> = {
  stage_completed: "evidence",
  practice_artifact_accepted: "evidence",
  practice_artifact_failed: "evidence",
  final_artifact_accepted_1: "evidence",
  final_artifact_accepted_2: "evidence",
  final_artifact_accepted_3: "evidence",
  final_artifact_failed: "evidence",
  manual_eval_accepted: "evidence",
  fallback_eval_failed: "evidence",
  course_completed_on_time: "evidence",
  fast_track_capability: "evidence",
  capstone_completed: "evidence",
  daily_login: "engagement",
  profile_completed: "engagement",
  streak_7_day: "engagement",
  consistency_30_day: "engagement",
  readiness_milestone_25: "engagement",
  readiness_milestone_50: "engagement",
  readiness_milestone_75: "engagement",
  readiness_milestone_100: "engagement",
  legacy_consistency_bonus: "engagement",
  promotional_xp: "engagement",
};

/**
 * Generate standard idempotency key for XP events (TRD §10)
 */
export function generateIdempotencyKey(
  userId: string,
  eventType: string,
  sourceId: string,
  metadata: Record<string, unknown> = {},
): string {
  switch (eventType) {
    case "stage_completed":
      return `stage:${userId}:${sourceId}`;
    case "practice_artifact_accepted":
      return `practice:${userId}:${sourceId}`;
    case "practice_artifact_failed":
      return `practice_fail:${userId}:${sourceId}`;
    case "final_artifact_accepted_1":
    case "final_artifact_accepted_2":
    case "final_artifact_accepted_3":
      return `final:${userId}:${sourceId}`;
    case "final_artifact_failed":
      return `final_fail:${userId}:${sourceId}`;
    case "manual_eval_accepted":
      return `manual:${userId}:${sourceId}`;
    case "fallback_eval_failed":
      return `fallback_fail:${userId}:${sourceId}`;
    case "course_completed_on_time":
      return `course:${userId}:${sourceId}`;
    case "fast_track_capability":
      return `fasttrack:${userId}:${sourceId}`;
    case "capstone_completed":
      return `capstone:${userId}:${sourceId}`;
    case "daily_login": {
      const loginDate =
        metadata && typeof metadata["login_date"] === "string"
          ? metadata["login_date"]
          : new Date().toISOString().split("T")[0];
      return `login:${userId}:${loginDate}`;
    }
    case "profile_completed":
      return `profile:${userId}`;
    case "streak_7_day": {
      const streakDate =
        metadata && typeof metadata["streak_date"] === "string"
          ? metadata["streak_date"]
          : new Date().toISOString().split("T")[0];
      return `streak7:${userId}:${streakDate}`;
    }
    case "consistency_30_day": {
      const consistencyDate =
        metadata && typeof metadata["consistency_date"] === "string"
          ? metadata["consistency_date"]
          : new Date().toISOString().split("T")[0];
      return `consistency30:${userId}:${consistencyDate}`;
    }
    case "readiness_milestone_25":
      return `milestone25:${userId}:${sourceId}`;
    case "readiness_milestone_50":
      return `milestone50:${userId}:${sourceId}`;
    case "readiness_milestone_75":
      return `milestone75:${userId}:${sourceId}`;
    case "readiness_milestone_100":
      return `milestone100:${userId}:${sourceId}`;
    case "legacy_consistency_bonus": {
      const currentYear = new Date().getFullYear().toString();
      return `legacy_bonus:${userId}:${currentYear}`;
    }
    case "promotional_xp":
      return `promo:${userId}:${sourceId}`;
    default:
      return `generic:${userId}:${eventType}:${sourceId}`;
  }
}

/**
 * Core XP Awarding logic. Enforces category, unique idempotency key,
 * and records database events securely.
 */
export async function awardXp(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  sourceType: string,
  sourceId: string,
  metadata: Record<string, unknown> = {},
  customXpAmount?: number,
): Promise<{ success: boolean; xpAwarded: number; alreadyAwarded: boolean }> {
  const xpAmount = customXpAmount !== undefined ? customXpAmount : (XP_AMOUNTS[eventType] ?? 0);
  const xpCategory = XP_CATEGORIES[eventType] ?? "engagement";
  const idempotencyKey = generateIdempotencyKey(userId, eventType, sourceId, metadata);

  try {
    const { error } = await supabase.from("xp_events").insert({
      user_id: userId,
      event_type: eventType,
      xp_category: xpCategory,
      xp_amount: xpAmount,
      source_type: sourceType,
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      metadata,
    });

    if (error) {
      // Postgres unique constraint violation code is '23505'
      if (error.code === "23505") {
        return { success: true, xpAwarded: 0, alreadyAwarded: true };
      }
      throw error;
    }

    return { success: true, xpAwarded: xpAmount, alreadyAwarded: false };
  } catch (error) {
    apiLogger.error("Error awarding XP", error);
    throw error;
  }
}
