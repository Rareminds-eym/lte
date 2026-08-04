import {
  deactivateOtherPaths,
  getActiveLearningPath,
  syncUserCapabilities,
  upsertLearningPath,
  upsertLearningTrack,
} from "@functions/api/v1/learning-paths/queries";
import { createLogger } from "@functions/lib/logger";
import { callSkill } from "@functions/lib/skill-gateway";
import type { LteEnv } from "@functions/lib/types";
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
      }),
    )
    .optional(),
});

export type ActiveLearningPath = NonNullable<Awaited<ReturnType<typeof getActiveLearningPath>>>;

export interface ResolvedTrack {
  data: ActiveLearningPath | null;
  needsAssessment: boolean;
}

/**
 * Resolve the learner's track in 3 layers:
 *  1. LTE local state (active learning path; history re-activation is handled
 *     by getActiveLearningPath callers — here we only check the active row).
 *  2. SkillPassport gateway (read-only, no sso in the data path) — on hit,
 *     map the Skill role title to the LTE roles catalog and persist track/path.
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
  const local = await getActiveLearningPath(supabase, userId);
  if (local) return { data: local, needsAssessment: false };

  // Search for any inactive learning path for this user and reactivate it
  const { data: inactivePath, error: inactiveError } = await supabase
    .from("learning_paths")
    .select(`
      id,
      learning_track_id,
      role_id,
      learning_tracks (
        track,
        fit,
        match_score
      )
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inactivePath && !inactiveError) {
    // Reactivate this path by setting is_active = true
    const { error: reactivateError } = await supabase
      .from("learning_paths")
      .update({ is_active: true })
      .eq("id", inactivePath.id);

    if (!reactivateError) {
      const trackData = Array.isArray(inactivePath.learning_tracks)
        ? inactivePath.learning_tracks[0]
        : inactivePath.learning_tracks;

      return {
        data: {
          learningPathId: inactivePath.id,
          learningTrackId: inactivePath.learning_track_id,
          roleId: inactivePath.role_id,
          track: trackData?.track ?? "",
          fit: trackData?.fit ?? "",
          matchScore: trackData?.match_score ?? 0,
        },
        needsAssessment: false,
      };
    }
  }

  // Layer 2 — SkillPassport gateway.
  try {
    const raw = await callSkill(env, "learning-track:get", { userId }, userId);
    const parsed = LearningTrackDataSchema.safeParse(raw);
    if (parsed.success && parsed.data.found) {
      const tracks = parsed.data.tracks || (parsed.data.track ? [parsed.data.track] : []);
      if (tracks.length > 0) {
        // Deactivate other paths first to ensure only the new primary path is active
        await deactivateOtherPaths(supabase, userId);

        for (const [i, track] of tracks.entries()) {
          const roleId = track.roleId || (await resolveRoleId(supabase, track.roleName));
          const trackId = await upsertLearningTrack(supabase, {
            userId,
            attemptId: track.attemptId,
            fit: track.fit,
            track: track.trackName,
            matchScore: track.matchScore,
            whyItFits: track.whyItFits,
          });

          const isActive = i === 0;
          const learningPathId = await upsertLearningPath(supabase, {
            userId,
            trackId,
            roleId,
            isActive,
          });

          if (isActive) {
            await syncUserCapabilities(supabase, { userId, learningPathId, roleId });
          }
        }

        const refreshed = await getActiveLearningPath(supabase, userId);
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
