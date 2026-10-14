/**
 * Unit Tests for Deterministic UUID Generator
 *
 * Tests the UUID generation functions for:
 * - Deterministic UUID generation
 * - UUID format validation
 * - Batch operations
 * - UUID mapping creation
 */

import { describe, expect, it } from "vitest";
import {
  batchEnsureUUIDs,
  createUUIDMapping,
  deterministicUUID,
  ensureUUID,
  isUUID,
  validateDeterministicUUID,
} from "../ingestion/uuid-generator";

describe("deterministicUUID", () => {
  it("should generate a valid UUID for table and value", () => {
    const uuid = deterministicUUID("capabilities", "WEB_DEV");

    expect(uuid).toBeDefined();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("should generate the same UUID for the same input", () => {
    const uuid1 = deterministicUUID("capabilities", "WEB_DEV");
    const uuid2 = deterministicUUID("capabilities", "WEB_DEV");

    expect(uuid1).toBe(uuid2);
  });

  it("should generate different UUIDs for different values", () => {
    const uuid1 = deterministicUUID("capabilities", "WEB_DEV");
    const uuid2 = deterministicUUID("capabilities", "API_DEV");

    expect(uuid1).not.toBe(uuid2);
  });

  it("should generate different UUIDs for different tables", () => {
    const uuid1 = deterministicUUID("capabilities", "CODE_123");
    const uuid2 = deterministicUUID("skills", "CODE_123");

    expect(uuid1).not.toBe(uuid2);
  });

  it("should trim whitespace from values", () => {
    const uuid1 = deterministicUUID("capabilities", "  WEB_DEV  ");
    const uuid2 = deterministicUUID("capabilities", "WEB_DEV");

    expect(uuid1).toBe(uuid2);
  });

  it("should be case-sensitive for values", () => {
    const uuid1 = deterministicUUID("capabilities", "web_dev");
    const uuid2 = deterministicUUID("capabilities", "WEB_DEV");

    expect(uuid1).not.toBe(uuid2);
  });

  it("should handle special characters in values", () => {
    const uuid = deterministicUUID("capabilities", "WEB-DEV_2.0");

    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("should handle empty strings", () => {
    const uuid = deterministicUUID("capabilities", "");

    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("should handle very long values", () => {
    const longValue = "A".repeat(1000);
    const uuid = deterministicUUID("capabilities", longValue);

    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe("isUUID", () => {
  describe("valid UUIDs", () => {
    it("should return true for valid lowercase UUID", () => {
      expect(isUUID("a1b2c3d4-1234-5678-90ab-cdef12345678")).toBe(true);
    });

    it("should return true for valid uppercase UUID", () => {
      expect(isUUID("A1B2C3D4-1234-5678-90AB-CDEF12345678")).toBe(true);
    });

    it("should return true for valid mixed-case UUID", () => {
      expect(isUUID("a1B2c3D4-1234-5678-90aB-CdEf12345678")).toBe(true);
    });

    it("should return true for UUID with all zeros", () => {
      expect(isUUID("00000000-0000-0000-0000-000000000000")).toBe(true);
    });

    it("should return true for UUID with all f's", () => {
      expect(isUUID("ffffffff-ffff-ffff-ffff-ffffffffffff")).toBe(true);
    });
  });

  describe("invalid UUIDs", () => {
    it("should return false for non-UUID strings", () => {
      expect(isUUID("not-a-uuid")).toBe(false);
    });

    it("should return false for UUID without hyphens", () => {
      expect(isUUID("a1b2c3d412345678 90abcdef12345678")).toBe(false);
    });

    it("should return false for UUID with wrong hyphen positions", () => {
      expect(isUUID("a1b2c3d4-12345-678-90ab-cdef12345678")).toBe(false);
    });

    it("should return false for UUID with invalid characters", () => {
      expect(isUUID("a1b2c3d4-1234-5678-90ab-cdef1234567g")).toBe(false);
    });

    it("should return false for UUID that is too short", () => {
      expect(isUUID("a1b2c3d4-1234-5678-90ab-cdef123456")).toBe(false);
    });

    it("should return false for UUID that is too long", () => {
      expect(isUUID("a1b2c3d4-1234-5678-90ab-cdef123456789")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isUUID(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isUUID(undefined)).toBe(false);
    });

    it("should return false for numbers", () => {
      expect(isUUID(123)).toBe(false);
    });

    it("should return false for objects", () => {
      expect(isUUID({ uuid: "a1b2c3d4-1234-5678-90ab-cdef12345678" })).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isUUID("")).toBe(false);
    });
  });
});

describe("ensureUUID", () => {
  it("should return existing valid UUID unchanged (lowercase)", () => {
    const validUUID = "a1b2c3d4-1234-5678-90ab-cdef12345678";
    expect(ensureUUID("capabilities", validUUID)).toBe(validUUID);
  });

  it("should normalize uppercase UUID to lowercase", () => {
    const uppercaseUUID = "A1B2C3D4-1234-5678-90AB-CDEF12345678";
    expect(ensureUUID("capabilities", uppercaseUUID)).toBe(uppercaseUUID.toLowerCase());
  });

  it("should generate deterministic UUID for non-UUID text", () => {
    const result = ensureUUID("capabilities", "WEB_DEV");

    expect(isUUID(result)).toBe(true);
    expect(result).toBe(deterministicUUID("capabilities", "WEB_DEV"));
  });

  it("should be idempotent - ensureUUID(ensureUUID(x)) === ensureUUID(x)", () => {
    const text = "WEB_DEV";
    const uuid1 = ensureUUID("capabilities", text);
    const uuid2 = ensureUUID("capabilities", uuid1);

    expect(uuid1).toBe(uuid2);
  });
});

describe("batchEnsureUUIDs", () => {
  it("should convert array of text IDs to UUIDs", () => {
    const textIds = ["WEB_DEV", "API_DEV", "DATA_SCIENCE"];
    const uuids = batchEnsureUUIDs("capabilities", textIds);

    expect(uuids).toHaveLength(3);
    expect(uuids.every((uuid) => isUUID(uuid))).toBe(true);
  });

  it("should preserve existing UUIDs in mixed array", () => {
    const validUUID = "a1b2c3d4-1234-5678-90ab-cdef12345678";
    const mixed = ["WEB_DEV", validUUID, "API_DEV"];
    const uuids = batchEnsureUUIDs("capabilities", mixed);

    expect(uuids).toHaveLength(3);
    expect(uuids[1]).toBe(validUUID);
    expect(isUUID(uuids[0])).toBe(true);
    expect(isUUID(uuids[2])).toBe(true);
  });

  it("should handle empty array", () => {
    const uuids = batchEnsureUUIDs("capabilities", []);

    expect(uuids).toEqual([]);
  });

  it("should maintain order of input array", () => {
    const textIds = ["FIRST", "SECOND", "THIRD"];
    const uuids = batchEnsureUUIDs("capabilities", textIds);

    expect(uuids[0]).toBe(deterministicUUID("capabilities", "FIRST"));
    expect(uuids[1]).toBe(deterministicUUID("capabilities", "SECOND"));
    expect(uuids[2]).toBe(deterministicUUID("capabilities", "THIRD"));
  });
});

describe("createUUIDMapping", () => {
  it("should create mapping from text IDs to UUIDs", () => {
    const textIds = ["WEB_DEV", "API_DEV"];
    const mapping = createUUIDMapping("capabilities", textIds);

    expect(mapping.size).toBe(2);
    expect(mapping.has("WEB_DEV")).toBe(true);
    expect(mapping.has("API_DEV")).toBe(true);
    expect(isUUID(mapping.get("WEB_DEV")!)).toBe(true);
    expect(isUUID(mapping.get("API_DEV")!)).toBe(true);
  });

  it("should generate consistent UUIDs for same text IDs", () => {
    const textIds = ["WEB_DEV"];
    const mapping1 = createUUIDMapping("capabilities", textIds);
    const mapping2 = createUUIDMapping("capabilities", textIds);

    expect(mapping1.get("WEB_DEV")).toBe(mapping2.get("WEB_DEV"));
  });

  it("should trim whitespace from text IDs", () => {
    const textIds = ["  WEB_DEV  ", "WEB_DEV"];
    const mapping = createUUIDMapping("capabilities", textIds);

    // Both should map to the same UUID (after trimming)
    expect(mapping.size).toBe(1);
    expect(mapping.has("WEB_DEV")).toBe(true);
  });

  it("should skip empty strings", () => {
    const textIds = ["WEB_DEV", "", "  ", "API_DEV"];
    const mapping = createUUIDMapping("capabilities", textIds);

    expect(mapping.size).toBe(2);
    expect(mapping.has("WEB_DEV")).toBe(true);
    expect(mapping.has("API_DEV")).toBe(true);
  });

  it("should handle empty array", () => {
    const mapping = createUUIDMapping("capabilities", []);

    expect(mapping.size).toBe(0);
  });

  it("should handle duplicate text IDs (keeps last)", () => {
    const textIds = ["WEB_DEV", "API_DEV", "WEB_DEV"];
    const mapping = createUUIDMapping("capabilities", textIds);

    expect(mapping.size).toBe(2);
    expect(mapping.get("WEB_DEV")).toBe(deterministicUUID("capabilities", "WEB_DEV"));
  });
});

describe("validateDeterministicUUID", () => {
  it("should return true for correct deterministic UUID", () => {
    const textId = "WEB_DEV";
    const uuid = deterministicUUID("capabilities", textId);

    expect(validateDeterministicUUID("capabilities", textId, uuid)).toBe(true);
  });

  it("should return false for incorrect UUID", () => {
    const textId = "WEB_DEV";
    const wrongUUID = deterministicUUID("capabilities", "DIFFERENT_ID");

    expect(validateDeterministicUUID("capabilities", textId, wrongUUID)).toBe(false);
  });

  it("should be case-insensitive for UUID comparison", () => {
    const textId = "WEB_DEV";
    const uuid = deterministicUUID("capabilities", textId);
    const uppercaseUUID = uuid.toUpperCase();

    expect(validateDeterministicUUID("capabilities", textId, uppercaseUUID)).toBe(true);
  });

  it("should return false for UUID from different table", () => {
    const textId = "CODE_123";
    const uuid = deterministicUUID("capabilities", textId);

    expect(validateDeterministicUUID("skills", textId, uuid)).toBe(false);
  });

  it("should handle whitespace in text ID", () => {
    const textId = "  WEB_DEV  ";
    const uuid = deterministicUUID("capabilities", textId.trim());

    expect(validateDeterministicUUID("capabilities", textId, uuid)).toBe(true);
  });
});

describe("integration scenarios", () => {
  it("should support typical ingestion workflow", () => {
    // 1. Parse Excel with text IDs
    const excelData = ["WEB_DEV", "API_DEV", "DATA_SCIENCE"];

    // 2. Create UUID mapping for lookups
    const mapping = createUUIDMapping("capabilities", excelData);

    // 3. Convert to UUIDs for database insert
    const uuids = batchEnsureUUIDs("capabilities", excelData);

    // Verify consistency
    expect(uuids[0]).toBe(mapping.get("WEB_DEV"));
    expect(uuids[1]).toBe(mapping.get("API_DEV"));
    expect(uuids[2]).toBe(mapping.get("DATA_SCIENCE"));
  });
});
