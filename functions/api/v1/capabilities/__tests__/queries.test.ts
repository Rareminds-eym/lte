import { apiLogger } from "@functions/shared/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCapabilitiesByRoleId,
  getLevelStatsForCapabilities,
  getLevelsForCapability,
  getUserCapabilitiesForRoles,
  getUserCapabilityProgressSummaries,
} from "../queries";

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

  describe("getLevelStatsForCapabilities", () => {
    it("returns empty maps for an empty capability id list", async () => {
      await expect(getLevelStatsForCapabilities(supabaseWith({}), [])).resolves.toEqual({
        counts: {},
        durationHours: {},
        xpSums: {},
      });
    });

    it("counts levels and sums total_xp and duration per capability", async () => {
      const supabase = supabaseWith({
        levels: {
          data: [
            { capability_id: "c1", id: "l1", total_xp: 10, duration_minutes: 60 },
            { capability_id: "c1", id: "l2", total_xp: 20, duration_minutes: 120 },
            { capability_id: "c2", id: "l3", total_xp: 5, duration_minutes: 30 },
            { capability_id: "c2", id: "l4", total_xp: null, duration_minutes: null },
          ],
        },
      });

      await expect(getLevelStatsForCapabilities(supabase, ["c1", "c2"])).resolves.toEqual({
        counts: { c1: 2, c2: 2 },
        durationHours: { c1: 3, c2: 1 },
        xpSums: { c1: 30, c2: 5 },
      });
    });

    it("throws when the query errors", async () => {
      const supabase = supabaseWith({ levels: { error: new Error("boom") } });
      await expect(getLevelStatsForCapabilities(supabase, ["c1"])).rejects.toThrow(
        "Failed to fetch level counts: boom",
      );
    });
  });

  describe("getUserCapabilitiesForRoles", () => {
    it("returns [] when no role ids are provided", async () => {
      await expect(
        getUserCapabilitiesForRoles(supabaseWith({}), "user-1", [], []),
      ).resolves.toEqual([]);
    });

    it("maps capabilities with xp totals and role info", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: {
          data: [
            {
              id: "s1",
              sequence_step: 1,
              required_level: "L1",
              capability_priority: "core",
              capabilities: { id: "c1", code: "C1", name: "One", description: "Desc1" },
            },
          ],
        },
        levels: {
          data: [{ capability_id: "c1", id: "l1", total_xp: 42, duration_minutes: 180 }],
        },
      });

      const result = await getUserCapabilitiesForRoles(
        supabase,
        "user-1",
        ["role-1"],
        [{ roleId: "role-1", roleName: "Learner" }],
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "c1",
        code: "C1",
        totalLevels: 1,
        currentLevel: 0,
        status: "not_started",
        progress: 0,
        durationHours: 3,
        xp: 42,
        roleId: "role-1",
        roleName: "Learner",
      });
    });
  });

  describe("getUserCapabilityProgressSummaries", () => {
    it("reports completed level count when every module in level one is completed", async () => {
      const supabase = supabaseWith({
        levels: {
          data: [
            { id: "l1", capability_id: "c1", level_code: "CAP_L1" },
            { id: "l2", capability_id: "c1", level_code: "CAP_L2" },
          ],
        },
        modules: {
          data: [
            { id: "m1", level_id: "l1" },
            { id: "m2", level_id: "l1" },
            { id: "m3", level_id: "l2" },
          ],
        },
        user_module_progress: {
          data: [
            { module_id: "m1", module_status: "completed", completion_percentage: 100 },
            { module_id: "m2", module_status: "completed", completion_percentage: 100 },
          ],
        },
      });

      await expect(getUserCapabilityProgressSummaries(supabase, "user-1", ["c1"])).resolves.toEqual(
        {
          c1: {
            currentLevel: 1,
            status: "in_progress",
            progress: 50,
          },
        },
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
