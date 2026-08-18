import { defineAction } from "../../../core/action";
import { UserPayloadSchema } from "../../../core/schemas";
import { getActiveTrackCapabilityIds } from "../../utils/active-track";
import { getSkillsForUser } from "../queries/get-skills";
import { mapSkillsToSyncPayload } from "../sync/payload";

/**
 * `skills:get` — read the granular skills a learner has EARNED from the levels
 * they completed within their active track's capabilities. READ-ONLY.
 *
 * Returns a flat list (no `resumeUrl` deep-link — a skill has no "continue
 * learning" destination), each entry with a content `fingerprint` so SkillPassport
 * can run a delta sync and skip unchanged skills. Reuses the shared payload
 * schema, active-track/capability-scope guard and fingerprint hashing.
 */
export const handleSkillsGet = defineAction({
  payloadSchema: UserPayloadSchema,
  run: async (_ctx, payload, supabase) => {
    const capabilityIds = await getActiveTrackCapabilityIds(supabase, payload.userId);
    if (!capabilityIds || capabilityIds.length === 0) {
      return { skills: [] };
    }

    const skills = await getSkillsForUser(supabase, payload.userId, capabilityIds);
    return { skills: await mapSkillsToSyncPayload(skills) };
  },
});
