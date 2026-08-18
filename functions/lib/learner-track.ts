import {
  type ActiveTrackDetail,
  deactivateOtherTracks,
  getActiveLearningTrack,
  syncUserCapabilities,
  upsertLearningPath,
  upsertLearningTrack,
} from "@functions/api/v1/learning-paths/queries";
import { callSkill } from "@functions/lib/gateway/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
import { createLogger } from "@functions/shared/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const logger = createLogger("learner-track");

const LearningTrackDataSchema = z.object({
  found: z.boolean(),
  track: z
    .object({
      attemptId: z.string(),
      roleId: z.string().optional(),
      roleName: z.string(),
      trackName: z.string(),
      fit: z.string(),
      matchScore: z.number(),
      whyItFits: z.string(),
      industry: z.string().optional(),
    })
    .optional(),
  tracks: z
    .array(
      z.object({
        attemptId: z.string(),
        roleId: z.string().optional(),
        roleName: z.string(),
        trackName: z.string(),
        fit: z.string(),
        matchScore: z.number(),
        whyItFits: z.string(),
        industry: z.string().optional(),
      }),
    )
    .optional(),
});

export interface ResolvedTrack {
  data: ActiveTrackDetail | null;
  needsAssessment: boolean;
}

/**
 * Resolve the learner's track in 3 layers:
 *  1. LTE local state (active learning track; history re-activation is handled
 *     by active track queries — here we only check the active track row).
 *  2. SkillPassport gateway (read-only, no sso in the data path) — on hit,
 *     map the Skill role title to the LTE roles catalog and persist track/paths.
 *  3. Nothing found -> { data: null, needsAssessment: true } (UI shows
 *     "Take Assessment").
 *
 * Never throws for gateway/network failures: Layer 2 errors fall through to
 * Layer 3 after logging (fail-closed, degraded-not-broken).
 */
export async function resolveActiveTrack(
  supabase: SupabaseClient,
  env: LteEnv,
  userId: string,
): Promise<ResolvedTrack> {
  // Layer 1 — LTE local state.
  const local = await getActiveLearningTrack(supabase, userId);
  if (local) return { data: local, needsAssessment: false };

  // Search for any inactive learning track for this user and reactivate it
  const { data: inactiveTrack, error: inactiveError } = await supabase
    .from("learning_tracks")
    .select("id, track, fit, match_score, why_it_fits")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inactiveTrack && !inactiveError) {
    // Reactivate this track by setting is_active = true
    const { error: reactivateError } = await supabase
      .from("learning_tracks")
      .update({ is_active: true })
      .eq("id", inactiveTrack.id);

    if (!reactivateError) {
      const refreshed = await getActiveLearningTrack(supabase, userId);
      if (refreshed) {
        return { data: refreshed, needsAssessment: false };
      }
    }
  }

  // Layer 2 — SkillPassport gateway.
  try {
    const raw = await callSkill(env, "learning-track:get", { userId }, userId);
    const parsed = LearningTrackDataSchema.safeParse(raw);
    if (parsed.success && parsed.data.found) {
      const tracks = parsed.data.tracks || (parsed.data.track ? [parsed.data.track] : []);
      if (tracks.length > 0) {
        // Deactivate other tracks first to ensure only the new primary track is active
        await deactivateOtherTracks(supabase, userId);

        const primaryTrackName = tracks[0]?.trackName;
        const trackMap = new Map<string, string>(); // trackName -> trackId

        for (const trackItem of tracks) {
          const roleId = trackItem.roleId || (await resolveRoleId(supabase, trackItem.roleName));
          const isActiveTrack = trackItem.trackName === primaryTrackName;

          let trackId = trackMap.get(trackItem.trackName);
          if (!trackId) {
            trackId = await upsertLearningTrack(supabase, {
              userId,
              attemptId: trackItem.attemptId,
              fit: trackItem.fit,
              track: trackItem.trackName,
              matchScore: trackItem.matchScore,
              whyItFits: trackItem.whyItFits,
              isActive: isActiveTrack,
            });
            trackMap.set(trackItem.trackName, trackId);
          }

          const learningPathId = await upsertLearningPath(supabase, {
            userId,
            trackId,
            roleId,
            metadata: trackItem.industry ? { industry: trackItem.industry } : {},
          });

          // Sync capabilities for any role belonging to the active track
          if (isActiveTrack) {
            await syncUserCapabilities(supabase, { userId, learningPathId, roleId });
          }
        }

        const refreshed = await getActiveLearningTrack(supabase, userId);
        return { data: refreshed, needsAssessment: false };
      }
    }
  } catch (error) {
    logger.warn("resolveActiveTrack Layer 2 failed — falling back to Layer 3", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Layer 3 — no track anywhere.
  return { data: null, needsAssessment: true };
}

/**
 * Map a Skill career-cluster title to an LTE roles.id:
 * exact case-insensitive name match -> contains match -> first catalog role.
 */
async function resolveRoleId(supabase: SupabaseClient, roleName: string): Promise<string> {
  const exact = await supabase
    .from("roles")
    .select("id")
    .ilike("role_name", roleName)
    .maybeSingle();
  if (exact.data?.id) return exact.data.id;

  const escaped = roleName.replace(/[%_\\]/g, (m) => `\\${m}`);
  const contains = await supabase
    .from("roles")
    .select("id")
    .ilike("role_name", `%${escaped}%`)
    .limit(1)
    .maybeSingle();
  if (contains.data?.id) return contains.data.id;

  const fallback = await supabase.from("roles").select("id").limit(1).maybeSingle();
  if (fallback.data?.id) return fallback.data.id;

  throw new Error("No roles available in LTE catalog");
}
