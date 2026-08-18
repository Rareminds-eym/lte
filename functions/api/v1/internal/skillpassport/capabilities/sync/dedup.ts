import type { CapabilityWithModules } from "../types";

/**
 * Deduplicate capabilities by id for the sync payload.
 *
 * The same capability can map to several roles → it is returned once per role
 * with a different `roleName` (which is part of the fingerprint). Two rows with
 * the same lte_course_id but different fingerprints would otherwise ping-pong
 * and defeat the delta sync. Keep one representative per id.
 */

/** Numeric rank of a capability's required level (e.g. "L3" → 3), 0 if absent. */
export function capabilityLevelRank(cap: CapabilityWithModules): number {
  const match = (cap.level ?? "").match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
}

/** Keep one capability per id, preferring the one with the highest required level. */
export function pickRepresentativeCapability(
  capabilities: CapabilityWithModules[],
): CapabilityWithModules[] {
  const representative = new Map<string, CapabilityWithModules>();
  for (const cap of capabilities) {
    const existing = representative.get(cap.id);
    if (!existing) {
      representative.set(cap.id, cap);
      continue;
    }
    if (capabilityLevelRank(cap) > capabilityLevelRank(existing)) {
      representative.set(cap.id, cap);
    }
  }
  return [...representative.values()];
}
