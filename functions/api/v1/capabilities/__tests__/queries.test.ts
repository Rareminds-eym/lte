import { apiLogger } from "@functions/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCapabilitiesByRoleId, getLevelsForCapability } from "../queries";

interface QueryChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (resolve: (val: unknown) => unknown) => Promise<unknown>;
}

function chainFor(data: unknown, error: unknown = null): QueryChain {
  const chain: QueryChain = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: (resolve: (val: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

function supabaseWith(tables: Record<string, { data?: unknown; error?: unknown }>): SupabaseClient {
  return {
    from: vi
      .fn()
      .mockImplementation((table: string) =>
        chainFor(tables[table]?.data, tables[table]?.error ?? null),
      ),
  } as unknown as SupabaseClient;
}

const arrayCapabilityRow = {
  id: "s1",
  sequence_step: 1,
  required_level: "L1",
  capability_priority: "core",
  capabilities: [{ id: "c1", code: "C1", name: "One", description: "Desc1" }],
};

const objectCapabilityRow = {
  id: "s2",
  sequence_step: null,
  required_level: null,
  capability_priority: null,
  capabilities: { id: "c2", code: "C2", name: "Two", description: "Desc2" },
};

describe("capabilities queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCapabilitiesByRoleId", () => {
    it("maps array and object capabilities, falling back for null fields", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: { data: [arrayCapabilityRow, objectCapabilityRow] },
      });

      await expect(getCapabilitiesByRoleId(supabase, "role-1")).resolves.toEqual([
        {
          id: "c1",
          name: "One",
          description: "Desc1",
          code: "C1",
          level: "L1",
          priority: "core",
          step: 1,
        },
        {
          id: "c2",
          name: "Two",
          description: "Desc2",
          code: "C2",
          level: undefined,
          priority: undefined,
          step: undefined,
        },
      ]);
    });

    it("falls back to empty values when the capability join is missing", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: {
          data: [
            {
              id: "s1",
              sequence_step: 1,
              required_level: "L1",
              capability_priority: "core",
              capabilities: undefined,
            },
          ],
        },
      });

      await expect(getCapabilitiesByRoleId(supabase, "role-1")).resolves.toEqual([
        {
          id: "",
          name: "",
          description: "",
          code: undefined,
          level: "L1",
          priority: "core",
          step: 1,
        },
      ]);
    });

    it("returns [] for null data and empty data", async () => {
      await expect(
        getCapabilitiesByRoleId(supabaseWith({ role_capability_sequence: { data: null } }), "r"),
      ).resolves.toEqual([]);
      await expect(
        getCapabilitiesByRoleId(supabaseWith({ role_capability_sequence: { data: [] } }), "r"),
      ).resolves.toEqual([]);
    });

    it("throws when the query errors", async () => {
      const supabase = supabaseWith({ role_capability_sequence: { error: new Error("boom") } });
      await expect(getCapabilitiesByRoleId(supabase, "role-1")).rejects.toThrow(
        "Failed to fetch role capabilities: boom",
      );
    });
  });

  describe("getLevelsForCapability", () => {
    it("throws when the query errors", async () => {
      const supabase = supabaseWith({ levels: { error: new Error("boom") } });
      await expect(getLevelsForCapability(supabase, "cap-1")).rejects.toThrow(
        "Failed to fetch capability levels: boom",
      );
    });

    it("returns [] when data is null", async () => {
      await expect(
        getLevelsForCapability(supabaseWith({ levels: { data: null } }), "cap-1"),
      ).resolves.toEqual([]);
    });

    it("normalizes deliverables, level numbers and defaults", async () => {
      const warnSpy = vi.spyOn(apiLogger, "warn");
      const supabase = supabaseWith({
        levels: {
          data: [
            {
              id: "l4",
              level_code: "RCP-L5",
              title: "T4",
              description: "D4",
              example_outputs: 42,
              duration_minutes: 90,
              difficulty_level: "advanced",
              status: "published",
            },
            {
              id: "l1",
              level_code: "L1",
              title: "T1",
              description: "D1",
              example_outputs: ["a", "b"],
              duration_minutes: 120,
              difficulty_level: "intermediate",
              status: "published",
            },
            {
              id: "l2",
              level_code: "L2",
              title: "T2",
              description: "D2",
              example_outputs: '["x","y"]',
              duration_minutes: null,
              difficulty_level: null,
              status: "draft",
            },
            {
              id: "l3",
              level_code: "bogus",
              title: "T3",
              description: "D3",
              example_outputs: "not json {",
              duration_minutes: null,
              difficulty_level: null,
              status: "draft",
            },
          ],
        },
      });

      const result = await getLevelsForCapability(supabase, "cap-1");
      expect(result.map((l) => l.levelNumber)).toEqual([1, 1, 2, 5]);
      const [l1Row, bogusRow, l2Row, l5Row] = result;
      expect(l1Row?.deliverables).toEqual(["a", "b"]);
      expect(bogusRow?.deliverables).toEqual(["not json {"]);
      expect(l2Row?.deliverables).toEqual(["x", "y"]);
      expect(l5Row?.deliverables).toEqual([]);
      expect(l2Row?.durationMinutes).toBe(0);
      expect(l2Row?.difficulty).toBe("intermediate");
      expect(l5Row?.durationMinutes).toBe(90);
      expect(l5Row?.difficulty).toBe("advanced");
      expect(warnSpy).toHaveBeenCalledWith("Unrecognized level_code format: bogus", {
        capabilityId: "cap-1",
      });
      warnSpy.mockRestore();
    });

    it("reads totalXp directly from the total_xp column (set by DB trigger)", async () => {
      const supabase = supabaseWith({
        levels: {
          data: [
            {
              id: "lvl-1",
              level_code: "L1",
              title: "Level 1",
              description: "Desc 1",
              total_xp: 42,
              status: "published",
            },
          ],
        },
      });

      const result = await getLevelsForCapability(supabase, "cap-1");
      expect(result).toHaveLength(1);
      expect(result[0]?.totalXp).toBe(42);
    });

    it("defaults totalXp to 0 when total_xp is missing", async () => {
      const supabase = supabaseWith({
        levels: {
          data: [
            {
              id: "lvl-1",
              level_code: "L1",
              title: "Level 1",
              description: "Desc 1",
              status: "published",
            },
          ],
        },
      });

      const result = await getLevelsForCapability(supabase, "cap-1");
      expect(result[0]?.totalXp).toBe(0);
    });
  });
});
