import { getUserCapabilitiesForRoles } from "@functions/api/v1/capabilities/queries";
import { getActiveLearningTrack } from "@functions/api/v1/learning-paths/queries";
import { z } from "zod";
import { defineAction } from "../action";
import { mapCapabilitiesToSyncPayload } from "../payload";

const CapabilitiesPayloadSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
});

/**
 * `capabilities:get` — read a learner's LTE capabilities, trimmed to the SP sync
 * payload (each `resumeUrl` built from LTE_PUBLIC_URL). READ-ONLY.
 *
 * Payload validation, the claim-match check, and the service supabase client
 * are handled by `defineAction`; this handler only provides its schema + logic.
 */
export const handleCapabilitiesGet = defineAction({
  payloadSchema: CapabilitiesPayloadSchema,
  run: async (ctx, payload, supabase) => {
    const activeTrack = await getActiveLearningTrack(supabase, payload.userId);
    if (!activeTrack || activeTrack.roles.length === 0) {
      return { capabilities: [] };
    }

    const capabilities = await getUserCapabilitiesForRoles(
      supabase,
      payload.userId,
      activeTrack.roles.map((r) => r.roleId),
      activeTrack.roles,
    );

    return { capabilities: mapCapabilitiesToSyncPayload(capabilities, ctx.env.LTE_PUBLIC_URL) };
  },
});
