import type { CallerConfig } from "./core/gateway";
import { handleCapabilitiesGet } from "./skillpassport/capabilities/actions/capabilities-get";
import { handleSkillsGet } from "./skillpassport/skills/actions/skills-get";

/**
 * Internal gateway caller registry — the composition root that wires the shared
 * gateway core to each external project. Every caller gets its OWN secret and
 * its OWN action registry, so one project's tokens can never reach another's
 * actions.
 *
 * Adding a project: one typed caller const here (own secret env var + own
 * actions) + a thin endpoint file (e.g. `api/v1/internal/<project>/index.ts`)
 * that calls `createInternalGateway(<caller>)`. The gateway-contract test pins
 * the `app` literal so cross-repo drift fails closed.
 */

/** SkillPassport caller — the only external project today. */
export const skillpassportCaller: CallerConfig = {
  app: "skillpassport",
  secretEnvKey: "SKILLPASSPORT_INTERNAL_SECRET",
  actions: {
    "capabilities:get": handleCapabilitiesGet,
    "skills:get": handleSkillsGet,
  },
};

/** Registry keyed by the token `app` claim — one entry per external project. */
export const CALLERS: Record<string, CallerConfig> = {
  skillpassport: skillpassportCaller,
};
