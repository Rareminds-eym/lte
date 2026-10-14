import { describe, expect, it } from "vitest";
import { CANONICAL_HASH_TEST_VECTORS, calculateHash } from "../ingestion/snapshot-serializer";
import { deterministicUUID } from "../ingestion/uuid-generator";

describe("persisted catalog compatibility", () => {
  it("keeps identifiers byte-compatible with the previous uuid.v5 implementation", () => {
    expect(deterministicUUID("levels", "LTE_CAP_L1")).toBe("609be854-972f-52be-b735-a6c6eb714585");
    expect(deterministicUUID("levels", " LTE_CAP_L1 ")).toBe(
      "609be854-972f-52be-b735-a6c6eb714585",
    );
  });
  it("keeps previously reviewed snapshot hashes valid", () => {
    for (const vector of CANONICAL_HASH_TEST_VECTORS)
      expect(calculateHash(vector.input)).toBe(vector.sha256);
  });
});
