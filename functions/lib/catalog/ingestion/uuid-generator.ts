/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
/**
 * Deterministic UUID Generator for LTE Ingestion
 *
 * Generates deterministic UUIDs using UUID v5 with a consistent namespace.
 * This ensures that the same input always produces the same UUID, which is
 * critical for idempotent uploads and conflict detection.
 *
 * Ported from Python reference: excel_to_lte_seed (2).py
 */

import { createHash } from "node:crypto";

function uuidv5(name: string, namespace: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(namespace.replace(/-/g, ""), "hex"))
    .update(name)
    .digest();
  hash[6] = (hash[6]! & 15) | 80;
  hash[8] = (hash[8]! & 63) | 128;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

import { UUID_NAMESPACE } from "./constants";

/**
 * Generate a deterministic UUID for a table/value combination
 *
 * Uses UUID v5 with a consistent namespace to ensure the same input
 * always produces the same UUID across different upload sessions.
 *
 * @param table - The table name (e.g., 'capabilities', 'levels')
 * @param value - The text identifier to convert to UUID
 * @returns A deterministic UUID string
 *
 * @example
 * deterministicUUID('capabilities', 'WEB_DEV')
 * // Always returns: 'a1b2c3d4-...' (same UUID every time)
 *
 * deterministicUUID('capabilities', 'WEB_DEV')
 * // Returns the exact same UUID as above
 */
export function deterministicUUID(table: string, value: string): string {
  const trimmedValue = value.trim();
  const namespacedValue = `${table}:${trimmedValue}`;

  return uuidv5(namespacedValue, UUID_NAMESPACE);
}

/**
 * Check if a value is a valid UUID
 *
 * Validates that a string matches the UUID format:
 * xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (hex digits with hyphens)
 *
 * @param value - The value to check
 * @returns True if the value is a valid UUID, false otherwise
 *
 * @example
 * isUUID('a1b2c3d4-1234-5678-90ab-cdef12345678') // true
 * isUUID('not-a-uuid') // false
 * isUUID(null) // false
 * isUUID(123) // false
 */
export function isUUID(value: any): boolean {
  if (typeof value !== "string") {
    return false;
  }

  // UUID regex: 8-4-4-4-12 hex digits with hyphens
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return uuidRegex.test(value);
}

/**
 * Convert a value to UUID, using deterministic generation if needed
 *
 * If the value is already a valid UUID, returns it as-is.
 * Otherwise, generates a deterministic UUID for the table/value combination.
 *
 * @param table - The table name
 * @param value - The identifier (UUID or text)
 * @returns A valid UUID string
 *
 * @example
 * ensureUUID('capabilities', 'a1b2c3d4-1234-5678-90ab-cdef12345678')
 * // Returns the same UUID (already valid)
 *
 * ensureUUID('capabilities', 'WEB_DEV')
 * // Generates deterministic UUID from text
 */
export function ensureUUID(table: string, value: string): string {
  if (isUUID(value)) {
    return value.toLowerCase();
  }

  return deterministicUUID(table, value);
}

/**
 * Batch convert multiple values to UUIDs
 *
 * Efficiently converts an array of identifiers to UUIDs,
 * using deterministic generation for non-UUID values.
 *
 * @param table - The table name for all values
 * @param values - Array of identifiers to convert
 * @returns Array of UUID strings
 *
 * @example
 * batchEnsureUUIDs('capabilities', ['WEB_DEV', 'API_DEV', 'existing-uuid-...'])
 * // Returns array of UUIDs (mixed generated and preserved)
 */
export function batchEnsureUUIDs(table: string, values: string[]): string[] {
  return values.map((value) => ensureUUID(table, value));
}

/**
 * Create a mapping from text IDs to deterministic UUIDs
 *
 * Useful for building lookup tables during ingestion to resolve
 * foreign key references from text identifiers to UUIDs.
 *
 * @param table - The table name
 * @param textIds - Array of text identifiers
 * @returns Map from text ID to generated UUID
 *
 * @example
 * const mapping = createUUIDMapping('capabilities', ['WEB_DEV', 'API_DEV']);
 * // { 'WEB_DEV': 'uuid-1', 'API_DEV': 'uuid-2' }
 */
export function createUUIDMapping(table: string, textIds: string[]): Map<string, string> {
  const mapping = new Map<string, string>();

  for (const textId of textIds) {
    const trimmedId = textId.trim();
    if (trimmedId) {
      mapping.set(trimmedId, deterministicUUID(table, trimmedId));
    }
  }

  return mapping;
}

/**
 * Validate that a UUID matches the expected deterministic UUID for a value
 *
 * Used to verify data integrity - checks if a stored UUID matches what
 * would be generated from the natural key value.
 *
 * @param table - The table name
 * @param value - The text identifier
 * @param uuid - The UUID to validate
 * @returns True if the UUID is correct for the value
 *
 * @example
 * validateDeterministicUUID('capabilities', 'WEB_DEV', 'expected-uuid-...')
 * // Returns true if uuid matches generated UUID for 'WEB_DEV'
 */
export function validateDeterministicUUID(table: string, value: string, uuid: string): boolean {
  const expectedUUID = deterministicUUID(table, value);
  return uuid.toLowerCase() === expectedUUID.toLowerCase();
}
