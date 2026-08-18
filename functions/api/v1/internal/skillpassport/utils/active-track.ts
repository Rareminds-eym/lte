import { getCapabilitiesByRoleId } from "@functions/api/v1/capabilities/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared guard for learner-scoped sync actions.
 *
 * Every action needs the learner's active track roles; when there is no active
 * track (or it has no roles) the feature returns an empty list rather than an
 * error. Centralizing this keeps the guard consistent across `capabilities:get`
 * and `skills:get` and avoids copy-pasting the track lookup.
 *
 * Returns the active track roles, or `null` when there is no usable active track.
 */
export async function getActiveTrackRolesOrEmpty(
  supabase: SupabaseClient,
  userId: string,
): Promise<Array<{ roleId: string; roleName: string }> | null> {
  const activeTrack = await getActiveLearningTrack(supabase, userId);
  if (!activeTrack || activeTrack.roles.length === 0) return null;
  return activeTrack.roles;
}

/**
 * Resolve the capability ids covered by the learner's active track, deduped.
 * Returns `null` when there is no usable active track, so callers can shortcut
 * to an empty result. A reusable scope for learner-scoped sync actions
 * (`skills:get` today, any future capability-scoped feature).
 */
export async function getActiveTrackCapabilityIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[] | null> {
  const roles = await getActiveTrackRolesOrEmpty(supabase, userId);
  if (!roles) return null;
  const capabilityArrays = await Promise.all(
    roles.map(async (role) => {
      const caps = await getCapabilitiesByRoleId(supabase, role.roleId);
      return caps.map((c) => c.id);
    }),
  );
  return [...new Set(capabilityArrays.flat())];
}
