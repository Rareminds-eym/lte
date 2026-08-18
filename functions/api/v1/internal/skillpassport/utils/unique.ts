/**
 * Shared helper: deduplicate an array by a key, keeping the FIRST occurrence
 * (input order is preserved). Reusable by any feature that needs stable
 * unique-by-key behaviour.
 */
export function uniqueBy<T>(items: T[], key: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  const result: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(item);
  }
  return result;
}
