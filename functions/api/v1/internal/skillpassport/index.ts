import { skillpassportCaller } from "../callers";
import { createInternalGateway } from "../core/gateway";

export { getPublicOrigin } from "../core/gateway";

/**
 * SkillPassport → LTE internal gateway — the single door for SP to read LTE data.
 *
 * The entire pipeline (auth → envelope → scope → dispatch → error mapping) lives
 * in `core/gateway.ts`; this file only wires the SkillPassport caller config, so
 * no business logic may live here. Adding another project = one typed caller in
 * `internal/callers.ts` + a thin endpoint like this one.
 */

/** Caller app the service token must present — pinned by the gateway-contract test. */
export const CALLER_APP = skillpassportCaller.app;

/** Actions this gateway dispatches — this caller's registry entry. */
export const REGISTRY = skillpassportCaller.actions;

/** Actions this gateway advertises — derived from the registry so it can't drift. */
export const SUPPORTED_ACTIONS: readonly string[] = Object.keys(REGISTRY);

/** Pages Functions entry point for POST /api/internal/skillpassport. */
export const onRequestPost = createInternalGateway(skillpassportCaller);
