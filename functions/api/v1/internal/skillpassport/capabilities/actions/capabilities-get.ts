import { getUserCapabilitiesForRoles } from "@functions/api/v1/capabilities/queries";
import { defineAction } from "../../../core/action";
import { UserPayloadSchema } from "../../../core/schemas";
import { getActiveTrackRolesOrEmpty } from "../../utils/active-track";
import { getCapabilityModuleSummaries } from "../queries/module-summaries";
import { pickRepresentativeCapability } from "../sync/dedup";
import { mapCapabilitiesToSyncPayload } from "../sync/payload";

/**
 * `capabilities:get` — read a learner's LTE capabilities, trimmed to the SP sync
 * payload (each `resumeUrl` built from the request origin, so dev/local and
 * production links are always correct). READ-ONLY.
 *
 * Payload validation, the claim-match check, and the service supabase client
 * are handled by `defineAction`; this handler only provides its schema + logic.
 *
 * The real level/module breakdown (levels → modules + the learner's per-level
 * progress) is computed here in the gateway via `getCapabilityModuleSummaries`
 * — it does NOT live in `api/v1/capabilities` so the shared catalog queries
 * remain untouched.
 */
export const handleCapabilitiesGet = defineAction({
  payloadSchema: UserPayloadSchema,
  run: async (ctx, payload, supabase) => {
    const roles = await getActiveTrackRolesOrEmpty(supabase, payload.userId);
    if (!roles) {
      return { capabilities: [] };
    }

    const capabilities = await getUserCapabilitiesForRoles(
      supabase,
      payload.userId,
      roles.map((r) => r.roleId),
      roles,
    );

    // Attach the course/module breakdown to each capability before syncing.
    const capabilityIds = Array.from(new Set(capabilities.map((c) => c.id)));
    const summaries = await getCapabilityModuleSummaries(supabase, payload.userId, capabilityIds);

    const enriched = capabilities.map((cap) => {
      const summary = summaries[cap.id];
      if (!summary) return cap;
      return {
        ...cap,
        totalModules: summary.totalModules,
        completedModules: summary.completedModules,
        levels: summary.levels.length > 0 ? summary.levels : undefined,
      };
    });

    // A capability mapped to several roles yields the same lte_course_id once per
    // role with a different roleName (part of the fingerprint), which would
    // otherwise ping-pong and defeat the delta sync. Keep one per id.
    const representative = pickRepresentativeCapability(enriched);

    return {
      capabilities: await mapCapabilitiesToSyncPayload(representative, ctx.origin),
    };
  },
});
