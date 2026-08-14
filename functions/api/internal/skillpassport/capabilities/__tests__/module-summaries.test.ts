import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getCapabilityModuleSummaries } from "../queries/module-summaries";

interface QueryChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  then: (resolve: (val: unknown) => unknown) => Promise<unknown>;
}

function chainFor(data: unknown, error: unknown = null): QueryChain {
  const chain: QueryChain = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    // biome-ignore lint/suspicious/noThenProperty: intentional mock of thenable for Supabase query chain.
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

const LEVELS = [
  { id: "lvl-1", capability_id: "cap-1", level_code: "L1", title: "Foundation" },
  { id: "lvl-2", capability_id: "cap-1", level_code: "L2", title: "Advanced" },
];

const MODULES = [
  { id: "mod-1", level_id: "lvl-1" },
  { id: "mod-2", level_id: "lvl-1" },
  { id: "mod-3", level_id: "lvl-2" },
];

const LEVEL_PROGRESS = [{ level_id: "lvl-1", status: "completed", completion_percentage: 100 }];

const MODULE_PROGRESS = [
  { module_id: "mod-1", module_status: "completed", completion_percentage: 100 },
  { module_id: "mod-3", module_status: "in_progress", completion_percentage: 50 },
];

describe("getCapabilityModuleSummaries", () => {
  it("returns an empty object for no capability ids", async () => {
    const supabase = supabaseWith({});
    await expect(getCapabilityModuleSummaries(supabase, "user-1", [])).resolves.toEqual({});
  });

  it("returns an empty object when none of the capabilities have published levels", async () => {
    const supabase = supabaseWith({ levels: { data: [] } });
    await expect(getCapabilityModuleSummaries(supabase, "user-1", ["cap-1"])).resolves.toEqual({});
  });

  it("builds per-level module totals and the learner's progress ladder", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      modules: { data: MODULES },
      user_capability_level_progress: { data: LEVEL_PROGRESS },
      user_module_progress: { data: MODULE_PROGRESS },
    });

    await expect(getCapabilityModuleSummaries(supabase, "user-1", ["cap-1"])).resolves.toEqual({
      "cap-1": {
        totalModules: 3,
        completedModules: 1,
        levels: [
          {
            id: "lvl-1",
            code: "L1",
            title: "Foundation",
            status: "completed",
            completionPercentage: 100,
            totalModules: 2,
            completedModules: 1,
          },
          {
            id: "lvl-2",
            code: "L2",
            title: "Advanced",
            status: "not_started",
            completionPercentage: 0,
            totalModules: 1,
            completedModules: 0,
          },
        ],
      },
    });
  });

  it("throws when the levels query fails", async () => {
    const supabase = supabaseWith({
      levels: { data: null, error: { message: "levels down" } },
    });
    await expect(getCapabilityModuleSummaries(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch capability module levels: levels down",
    );
  });

  it("throws when the modules query fails", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      modules: { data: null, error: { message: "modules down" } },
    });
    await expect(getCapabilityModuleSummaries(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch capability modules: modules down",
    );
  });

  it("throws when the level progress query fails", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      modules: { data: MODULES },
      user_capability_level_progress: { data: null, error: { message: "progress down" } },
    });
    await expect(getCapabilityModuleSummaries(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch capability level progress: progress down",
    );
  });

  it("throws when the module progress query fails", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      modules: { data: MODULES },
      user_capability_level_progress: { data: LEVEL_PROGRESS },
      user_module_progress: { data: null, error: { message: "module progress down" } },
    });
    await expect(getCapabilityModuleSummaries(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch user module progress: module progress down",
    );
  });
});
