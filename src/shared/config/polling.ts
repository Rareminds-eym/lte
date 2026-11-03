/**
 * Polling intervals for TanStack Query refetch cycles.
 *
 * Centralised here so every consumer uses the same cadence and changes
 * propagate without hunting for magic numbers across hooks.
 */

/** Interval for polling review status and dashboard feedback updates. */
export const REVIEW_POLLING_INTERVAL_MS = 30_000;
