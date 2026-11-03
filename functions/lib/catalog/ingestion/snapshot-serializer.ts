/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve the existing dynamic catalog snapshot/row contracts during this service-boundary migration. */
/**
 * Snapshot Serializer Module
 *
 * Creates immutable normalized snapshots with deterministic hashing.
 */

import crypto from "node:crypto";

export interface NormalizedSnapshot {
  tables: Record<
    string,
    {
      columns: string[];
      rows: any[][];
    }
  >;
  metadata: {
    sourceType: "xlsx" | "google_sheets";
    sourceName: string;
    tableCount: number;
    totalRows: number;
    parsedAt: string;
  };
}

/**
 * Create normalized snapshot from workbook data
 */
export function createSnapshot(
  workbookData: Map<string, any[]>,
  sourceType: "xlsx" | "google_sheets",
  sourceName: string,
): NormalizedSnapshot {
  const tables: Record<string, { columns: string[]; rows: any[][] }> = {};
  let totalRows = 0;

  for (const [tableName, rows] of workbookData.entries()) {
    if (rows.length === 0) continue;

    // Extract columns from first row
    const columns = Object.keys(rows[0]).sort();

    // Convert rows to arrays (ordered by columns)
    const rowArrays = rows.map((row) => columns.map((col) => row[col]));

    tables[tableName] = { columns, rows: rowArrays };
    totalRows += rows.length;
  }

  return {
    tables,
    metadata: {
      sourceType,
      sourceName,
      tableCount: Object.keys(tables).length,
      totalRows,
      parsedAt: new Date().toISOString(),
    },
  };
}

/**
 * Serialize snapshot to deterministic JSON string
 */
export function canonicalizeJSON(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

export function serializeSnapshot(snapshot: NormalizedSnapshot): string {
  return canonicalizeJSON(snapshot);
}

/**
 * Calculate SHA-256 hash of snapshot
 */
export function calculateHash(value: unknown): string {
  const serialized = canonicalizeJSON(value);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function sortObjectKeys(value: any): any {
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = sortObjectKeys(value[key]);
        return acc;
      }, {});
  }

  return value;
}

/**
 * Verify snapshot hash matches expected value
 */
export function verifyHash(value: unknown, expectedHash: string): boolean {
  const actualHash = calculateHash(value);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

export interface CanonicalHashTestVector {
  name: string;
  input: unknown;
  canonical: string;
  sha256: string;
}

export const CANONICAL_HASH_TEST_VECTORS: CanonicalHashTestVector[] = [
  {
    name: "null",
    input: null,
    canonical: "null",
    sha256: "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
  },
  {
    name: "true",
    input: true,
    canonical: "true",
    sha256: "b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b",
  },
  {
    name: "false",
    input: false,
    canonical: "false",
    sha256: "fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa",
  },
  {
    name: "zero",
    input: 0,
    canonical: "0",
    sha256: "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9",
  },
  {
    name: "decimal",
    input: 42.5,
    canonical: "42.5",
    sha256: "7b713affffacc53f6dbd3a5fd52117bc3eb5f3881789d2eb26b5f636daa066df",
  },
  {
    name: "string",
    input: "LTE",
    canonical: '"LTE"',
    sha256: "528b8f3b6734d16513c3360b97568abf94a4328ee5950fc92be8439bbafe44ff",
  },
  {
    name: "array",
    input: [],
    canonical: "[]",
    sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  },
  {
    name: "object",
    input: {},
    canonical: "{}",
    sha256: "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  },
  {
    name: "sorted keys",
    input: { b: 2, a: 1 },
    canonical: '{"a":1,"b":2}',
    sha256: "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
  },
  {
    name: "nested unicode",
    input: { nested: { z: "Ω", a: [3, 2, 1] } },
    canonical: '{"nested":{"a":[3,2,1],"z":"Ω"}}',
    sha256: "9bfca6e8282bbd764df1439ad78799d817c1de37d6163ee9f725b50ba8fc35e1",
  },
  {
    name: "date",
    input: new Date("2026-08-25T00:00:00.000Z"),
    canonical: '"2026-08-25T00:00:00.000Z"',
    sha256: "9d91bd3bfea6471c06e1112a893aa103642a63e8c64828580539410d8920e40c",
  },
];

for (const vector of CANONICAL_HASH_TEST_VECTORS) {
  if (
    canonicalizeJSON(vector.input) !== vector.canonical ||
    calculateHash(vector.input) !== vector.sha256
  ) {
    throw new Error(`Canonical JSON self-test failed for vector: ${vector.name}`);
  }
}
