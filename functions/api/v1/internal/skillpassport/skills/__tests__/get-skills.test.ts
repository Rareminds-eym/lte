import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getSkillsForUser } from "../queries/get-skills";

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
  { id: "lvl-1", capability_id: "cap-1", level_code: "CAP-L1", title: "Foundation" },
  { id: "lvl-2", capability_id: "cap-1", level_code: "CAP-L2", title: "Advanced" },
];

const COMPLETED = [
  { level_id: "lvl-1", status: "completed", completed_at: "2026-08-13T05:11:42Z" },
  { level_id: "lvl-2", status: "completed", completed_at: "2026-08-13T09:49:54Z" },
];

const IN_PROGRESS = [{ level_id: "lvl-2", status: "in_progress", completed_at: null }];

const LEVEL_SKILLS = [
  { level_id: "lvl-1", skill_id: "skill-1" },
  { level_id: "lvl-1", skill_id: "skill-2" },
  { level_id: "lvl-2", skill_id: "skill-1" }, // same skill under another completed level
];

const SKILLS = [
  {
    id: "skill-1",
    code: "SK-001",
    name: "Classify Work Objects",
    description: "desc-1",
    tags: ["a", "b"],
  },
  { id: "skill-2", code: "SK-002", name: "Execute Tasks", description: "desc-2", tags: '["c"]' },
];

const CAPABILITIES = [{ id: "cap-1", code: "CAP", name: "Capability One" }];

describe("getSkillsForUser", () => {
  it("returns an empty array for no capability ids", async () => {
    const supabase = supabaseWith({});
    await expect(getSkillsForUser(supabase, "user-1", [])).resolves.toEqual([]);
  });

  it("returns an empty array when none of the capabilities have published levels", async () => {
    const supabase = supabaseWith({ levels: { data: [] } });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).resolves.toEqual([]);
  });

  it("returns an empty array when the learner has not completed any level", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: IN_PROGRESS },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).resolves.toEqual([]);
  });

  it("returns an empty array when no level_skills are mapped to completed levels", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: { data: [] },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).resolves.toEqual([]);
  });

  it("builds earned skills with level + capability context and dedups by skill", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: { data: LEVEL_SKILLS },
      skills: { data: SKILLS },
      capabilities: { data: CAPABILITIES },
    });

    const result = await getSkillsForUser(supabase, "user-1", ["cap-1"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "skill-1",
      code: "SK-001",
      name: "Classify Work Objects",
      levelId: "lvl-1",
      levelCode: "CAP-L1",
      capabilityCode: "CAP",
      capabilityName: "Capability One",
      levelStatus: "completed",
      completedAt: "2026-08-13T05:11:42Z",
    });
    expect(result[1]?.tags).toEqual(["c"]); // json-string tags are parsed
  });

  it("resolves a skill shared across completed levels to the earliest-completed level regardless of row order", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      // lvl-2 (completed 09:49) arrives BEFORE lvl-1 (completed 05:11) — the
      // result must still pick lvl-1 so the fingerprint is stable per skill.
      level_skills: {
        data: [
          { level_id: "lvl-2", skill_id: "skill-1" },
          { level_id: "lvl-1", skill_id: "skill-1" },
        ],
      },
      skills: { data: SKILLS },
      capabilities: { data: CAPABILITIES },
    });

    const result = await getSkillsForUser(supabase, "user-1", ["cap-1"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "skill-1",
      levelId: "lvl-1",
      levelCode: "CAP-L1",
      completedAt: "2026-08-13T05:11:42Z",
    });
  });

  it("throws when the levels query fails", async () => {
    const supabase = supabaseWith({ levels: { data: null, error: { message: "levels down" } } });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch levels: levels down",
    );
  });

  it("throws when the level progress query fails", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: null, error: { message: "progress down" } },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch level progress: progress down",
    );
  });

  it("throws when the level skills query fails", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: { data: null, error: { message: "level skills down" } },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch level skills: level skills down",
    );
  });

  it("throws when the skills query fails", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: { data: LEVEL_SKILLS },
      skills: { data: null, error: { message: "skills down" } },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch skills: skills down",
    );
  });

  it("throws when the capabilities query fails", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: { data: LEVEL_SKILLS },
      skills: { data: SKILLS },
      capabilities: { data: null, error: { message: "capabilities down" } },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).rejects.toThrow(
      "Failed to fetch capabilities: capabilities down",
    );
  });

  it("returns an empty array when the levels query returns null data", async () => {
    const supabase = supabaseWith({ levels: { data: null } });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).resolves.toEqual([]);
  });

  it("returns an empty array when the level progress query returns null data", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: null },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).resolves.toEqual([]);
  });

  it("returns an empty array when the level_skills query returns null data", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: { data: null },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).resolves.toEqual([]);
  });

  it("returns an empty array when the skills query returns null data", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: { data: LEVEL_SKILLS },
      skills: { data: null },
    });
    await expect(getSkillsForUser(supabase, "user-1", ["cap-1"])).resolves.toEqual([]);
  });

  it("treats a completed row without completed_at as a valid but timestamp-less completion", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: {
        data: [{ level_id: "lvl-1", status: "completed", completed_at: null }],
      },
      level_skills: { data: [{ level_id: "lvl-1", skill_id: "skill-1" }] },
      skills: { data: SKILLS },
      capabilities: { data: CAPABILITIES },
    });

    const result = await getSkillsForUser(supabase, "user-1", ["cap-1"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "skill-1", levelId: "lvl-1" });
    expect(result[0]?.completedAt).toBeUndefined();
  });

  it("parses tags defensively across mixed shapes", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: {
        data: [
          { level_id: "lvl-1", skill_id: "s-num" },
          { level_id: "lvl-1", skill_id: "s-empty" },
          { level_id: "lvl-1", skill_id: "s-json" },
          { level_id: "lvl-1", skill_id: "s-badjson" },
          { level_id: "lvl-1", skill_id: "s-mixed" },
        ],
      },
      skills: {
        data: [
          { id: "s-num", code: "N", name: "N", description: "d", tags: 42 },
          { id: "s-empty", code: "E", name: "E", description: "d", tags: "" },
          { id: "s-json", code: "J", name: "J", description: "d", tags: '{"x":1}' },
          { id: "s-badjson", code: "B", name: "B", description: "d", tags: "not-json" },
          { id: "s-mixed", code: "M", name: "M", description: "d", tags: ["a", 7, true] },
        ],
      },
      capabilities: { data: CAPABILITIES },
    });

    const result = await getSkillsForUser(supabase, "user-1", ["cap-1"]);
    const bySkill = new Map(result.map((s) => [s.id, s]));
    expect(bySkill.get("s-num")?.tags).toBeUndefined();
    expect(bySkill.get("s-empty")?.tags).toBeUndefined();
    expect(bySkill.get("s-json")?.tags).toBeUndefined();
    expect(bySkill.get("s-badjson")?.tags).toBeUndefined();
    expect(bySkill.get("s-mixed")?.tags).toEqual(["a", "7", "true"]);
  });

  it("skips rows referencing missing skills/levels and tolerates missing capability context", async () => {
    const supabase = supabaseWith({
      levels: { data: LEVELS },
      user_capability_level_progress: { data: COMPLETED },
      level_skills: {
        data: [
          { level_id: "lvl-ghost", skill_id: "skill-ghost" }, // level not present -> skipped
          { level_id: "lvl-1", skill_id: "skill-missing" }, // skill not present -> skipped
          { level_id: "lvl-1", skill_id: "skill-1" },
          { level_id: "lvl-ghost-2", skill_id: "skill-ghost-2" }, // ghost level in the b-side of the sort
        ],
      },
      skills: {
        data: [{ id: "skill-1", code: null, name: "No Code", description: null, tags: null }],
      },
      capabilities: { data: null }, // capability cap-1 missing from catalog
    });

    const result = await getSkillsForUser(supabase, "user-1", ["cap-1"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "skill-1", levelId: "lvl-1" });
    expect(result[0]?.code).toBeUndefined();
    expect(result[0]?.description).toBeUndefined();
    expect(result[0]?.tags).toBeUndefined();
    expect(result[0]?.capabilityCode).toBeUndefined();
    expect(result[0]?.capabilityName).toBe("");
  });
});
