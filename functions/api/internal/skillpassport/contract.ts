/**
 * SkillPassport → LTE internal gateway protocol contract.
 *
 * CALLER_APP (and the action names in the dispatcher REGISTRY) MUST stay
 * identical to the SkillPassport caller side (functions/lib/lte/lte-capabilities.ts).
 * The two repos cannot import each other, so these literals are pinned by the
 * gateway-contract test; on mismatch the gateway fails closed (403/404) rather
 * than corrupting data.
 */
export const CALLER_APP = "skillpassport";
