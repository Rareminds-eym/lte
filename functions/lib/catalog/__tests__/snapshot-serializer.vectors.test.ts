import { describe, expect, it } from "vitest";
import {
  CANONICAL_HASH_TEST_VECTORS,
  calculateHash,
  canonicalizeJSON,
} from "../ingestion/snapshot-serializer";

describe("canonical hash cross-service vectors", () => {
  it("exports at least ten stable vectors", () => {
    expect(CANONICAL_HASH_TEST_VECTORS.length).toBeGreaterThanOrEqual(10);
  });

  it.each(CANONICAL_HASH_TEST_VECTORS)("$name", ({ input, canonical, sha256 }) => {
    expect(canonicalizeJSON(input)).toBe(canonical);
    expect(calculateHash(input)).toBe(sha256);
  });
});
