import {
  type ActiveTrackDetail,
  deactivateOtherTracks,
  getActiveLearningTrack,
  syncUserCapabilities,
  upsertLearningPath,
  upsertLearningTrack,
} from "@functions/api/v1/learning-paths/queries";
import { callSkill } from "@functions/lib/gateway/skill-gateway";
import {
  asQueryGateway,
  type QueryGateway,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import type { LteEnv } from "@functions/lib/types";
import { createLogger } from "@functions/shared/logger";
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

const latestLearningTrackReadPolicy = {
  table: "learning_tracks",
  operation: "read",
  columns: ["id", "track", "fit", "match_score", "why_it_fits"],
  filters: ["user_id"],
  sorts: ["updated_at"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const learningTrackReactivatePolicy = {
  table: "learning_tracks",
  operation: "update",
  updateColumns: ["is_active"],
  filters: ["user_id", "id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;

const roleByNameReadPolicy = {
  table: "roles",
  operation: "read",
  columns: ["id"],
  filters: ["role_name"],
} as const;

const fallbackRoleReadPolicy = {
  table: "roles",
  operation: "read",
  columns: ["id"],
} as const;

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
  source: QueryGatewaySource,
  env: LteEnv,
  userId: string,
): Promise<ResolvedTrack> {
  const qb = asQueryGateway(source);
  // Layer 1 — LTE local state.
  const local = await getActiveLearningTrack(qb, userId);
  if (local) return { data: local, needsAssessment: false };

  // Search for any inactive learning track for this user and reactivate it
  let inactiveTrack: { id: string } | null = null;
  try {
    inactiveTrack = (await qb.read(latestLearningTrackReadPolicy, {
      auth: { userId },
      sort: [{ column: "updated_at", ascending: false }],
      limit: 1,
      result: "maybeSingle",
    })) as { id: string } | null;
  } catch {
    inactiveTrack = null;
  }

  if (inactiveTrack) {
    // Reactivate this track by setting is_active = true
    try {
      await qb.update(learningTrackReactivatePolicy, {
        auth: { userId },
        data: { is_active: true },
        filters: [{ column: "id", op: "eq", value: inactiveTrack.id }],
      });
      const refreshed = await getActiveLearningTrack(qb, userId);
      if (refreshed) {
        return { data: refreshed, needsAssessment: false };
      }
    } catch {
      // Fall through to SkillPassport lookup.
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
        await deactivateOtherTracks(qb, userId);

        const primaryTrackName = tracks[0]?.trackName;
        const trackMap = new Map<string, string>(); // trackName -> trackId

        for (const trackItem of tracks) {
          const roleId = trackItem.roleId || (await resolveRoleId(qb, trackItem.roleName));
          const isActiveTrack = trackItem.trackName === primaryTrackName;

          let trackId = trackMap.get(trackItem.trackName);
          if (!trackId) {
            trackId = await upsertLearningTrack(qb, {
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

          const learningPathId = await upsertLearningPath(qb, {
            userId,
            trackId,
            roleId,
            metadata: trackItem.industry ? { industry: trackItem.industry } : {},
          });

          // Sync capabilities for any role belonging to the active track
          if (isActiveTrack) {
            await syncUserCapabilities(qb, { userId, learningPathId, roleId });
          }
        }

        const refreshed = await getActiveLearningTrack(qb, userId);
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
async function resolveRoleId(qb: QueryGateway, roleName: string): Promise<string> {
  const exact = (await qb.read(roleByNameReadPolicy, {
    filters: [{ column: "role_name", op: "ilike", value: roleName }],
    result: "maybeSingle",
  })) as { id: string } | null;
  if (exact?.id) return exact.id;

  const escaped = roleName.replace(/[%_\\]/g, (m) => `\\${m}`);
  const contains = (await qb.read(roleByNameReadPolicy, {
    filters: [{ column: "role_name", op: "ilike", value: `%${escaped}%` }],
    limit: 1,
    result: "maybeSingle",
  })) as { id: string } | null;
  if (contains?.id) return contains.id;

  const fallback = (await qb.read(fallbackRoleReadPolicy, {
    limit: 1,
    result: "maybeSingle",
  })) as { id: string } | null;
  if (fallback?.id) return fallback.id;

  throw new Error("No roles available in LTE catalog");
}
