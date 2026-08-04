import { describe, expect, it } from "vitest";
import { getLevelWithModules } from "../queries";
import { err, levelChains, makeSupabase, ok } from "./helpers";

describe("getLevelWithModules", () => {
  it("returns null when the level fetch resolves with PGRST116", async () => {
    const supabase = makeSupabase(levelChains({ levelResult: err("not found", "PGRST116") }));
    await expect(getLevelWithModules(supabase, "level-1")).resolves.toBeNull();
  });

  it("throws when the level fetch fails with another error", async () => {
    const supabase = makeSupabase(levelChains({ levelResult: err("db down") }));
    await expect(getLevelWithModules(supabase, "level-1")).rejects.toThrow(
      "Failed to fetch level: db down",
    );
  });

  it("returns null when the level data is missing without an error", async () => {
    const supabase = makeSupabase(levelChains({ levelResult: { data: null, error: null } }));
    await expect(getLevelWithModules(supabase, "level-1")).resolves.toBeNull();
  });

  it("returns full level details with capability when capability_id is present", async () => {
    const supabase = makeSupabase(levelChains());
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      id: "level-1",
      levelCode: "RCP-L1",
      capabilityCode: "CAP",
      capabilityName: "Capability",
      title: "Level One",
      description: "Level description",
      durationMinutes: 45,
      difficultyLevel: "beginner",
      levelStatus: "active",
      versionNo: 1,
      artifactsCount: 0,
    });
    expect(result?.levelProblemStatement).toEqual({
      title: "Level One",
      description: "Level description",
    });
  });

  it("skips capability fetch when capability_id is absent", async () => {
    const supabase = makeSupabase(
      levelChains({ level: { capability_id: null }, capabilities: err("should not run") }),
    );
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.capabilityCode).toBeUndefined();
    expect(result?.capabilityName).toBeUndefined();
  });

  it("throws when the modules fetch fails", async () => {
    const supabase = makeSupabase(levelChains({ modules: err("modules down") }));
    await expect(getLevelWithModules(supabase, "level-1")).rejects.toThrow(
      "Failed to fetch modules: modules down",
    );
  });

  it("returns an empty module list when modules data is null", async () => {
    const supabase = makeSupabase(levelChains({ modules: { data: null, error: null } }));
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.modules).toEqual([]);
    expect(result?.artifactsCount).toBe(0);
  });

  it("filters inactive modules and sorts by module_no", async () => {
    const modules = [
      {
        id: "mod-1",
        module_no: 2,
        title: "Second",
        description: "d2",
        is_published: true,
        is_active: true,
      },
      {
        id: "mod-2",
        module_no: 1,
        title: "First",
        description: "d1",
        is_published: false,
        is_active: true,
      },
      {
        id: "mod-3",
        module_no: 3,
        title: "Hidden",
        description: "d3",
        is_published: true,
        is_active: false,
      },
    ];
    const supabase = makeSupabase(levelChains({ modules: ok(modules) }));
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.modules.map((m) => m.id)).toEqual(["mod-2", "mod-1"]);
    expect(result?.modules[0]?.isPublished).toBe(false);
    expect(result?.modules[1]?.isPublished).toBe(true);
    expect(result?.modules.every((m) => m.progressPercentage === 0)).toBe(true);
  });

  it("maps user progress including completed stages when userId is provided", async () => {
    const modules = [
      {
        id: "mod-1",
        module_no: 1,
        title: "First",
        description: "d1",
        is_published: true,
        is_active: true,
      },
      {
        id: "mod-2",
        module_no: 2,
        title: "Second",
        description: "d2",
        is_published: true,
        is_active: true,
      },
    ];
    const progresses = [
      { id: "mp-1", module_id: "mod-1", completion_percentage: 50, module_status: "completed" },
      { id: "mp-2", module_id: "mod-2", completion_percentage: null, module_status: "in_progress" },
    ];
    const supabase = makeSupabase(
      levelChains({
        modules: ok(modules),
        levelProgress: ok({ id: "lp-1" }),
        progresses: ok(progresses),
        stages: ok([{ stage_name: "Engage" }, { stage_name: "EXPLORE" }]),
      }),
    );
    const result = await getLevelWithModules(supabase, "level-1", "user-1");
    expect(result?.modules[0]).toMatchObject({
      id: "mod-1",
      progressPercentage: 50,
      isCompleted: true,
      completedStages: ["engage", "explore"],
    });
    expect(result?.modules[1]).toMatchObject({
      id: "mod-2",
      progressPercentage: 0,
      isCompleted: false,
      completedStages: [],
    });
  });

  it("handles a missing level progress record for the user", async () => {
    const supabase = makeSupabase(levelChains({ levelProgress: { data: null, error: null } }));
    const result = await getLevelWithModules(supabase, "level-1", "user-1");
    expect(result?.modules).toHaveLength(0);
  });

  it("handles null progresses for the user", async () => {
    const supabase = makeSupabase(
      levelChains({ levelProgress: ok({ id: "lp-1" }), progresses: { data: null, error: null } }),
    );
    const result = await getLevelWithModules(supabase, "level-1", "user-1");
    expect(result?.modules).toEqual([]);
  });

  it("handles empty progresses and null stages", async () => {
    const modules = [
      {
        id: "mod-1",
        module_no: 1,
        title: "First",
        description: "d1",
        is_published: true,
        is_active: true,
      },
    ];
    const supabase = makeSupabase(
      levelChains({
        modules: ok(modules),
        levelProgress: ok({ id: "lp-1" }),
        progresses: ok([
          { id: "mp-1", module_id: "mod-1", completion_percentage: 0, module_status: "completed" },
        ]),
        stages: { data: null, error: null },
      }),
    );
    const result = await getLevelWithModules(supabase, "level-1", "user-1");
    expect(result?.modules[0]).toMatchObject({
      progressPercentage: 0,
      isCompleted: true,
      completedStages: [],
    });
  });

  it("counts active artifacts when modules_content exists", async () => {
    const modules = [
      {
        id: "mod-1",
        module_no: 1,
        title: "T",
        description: "d",
        is_published: true,
        is_active: true,
      },
    ];
    const supabase = makeSupabase(
      levelChains({
        modules: ok(modules),
        modulesContent: ok([{ id: "mc-1" }, { id: "mc-2" }]),
        artifacts: ok([{ id: "a-1" }, { id: "a-2" }]),
      }),
    );
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.artifactsCount).toBe(2);
  });

  it("keeps artifact count at 0 when modules_content is empty", async () => {
    const modules = [
      {
        id: "mod-1",
        module_no: 1,
        title: "T",
        description: "d",
        is_published: true,
        is_active: true,
      },
    ];
    const supabase = makeSupabase(levelChains({ modules: ok(modules), modulesContent: ok([]) }));
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.artifactsCount).toBe(0);
  });

  it("keeps artifact count at 0 when modules_content is null", async () => {
    const modules = [
      {
        id: "mod-1",
        module_no: 1,
        title: "T",
        description: "d",
        is_published: true,
        is_active: true,
      },
    ];
    const supabase = makeSupabase(
      levelChains({ modules: ok(modules), modulesContent: { data: null, error: null } }),
    );
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.artifactsCount).toBe(0);
  });

  it("keeps artifact count at 0 when artifacts is null", async () => {
    const modules = [
      {
        id: "mod-1",
        module_no: 1,
        title: "T",
        description: "d",
        is_published: true,
        is_active: true,
      },
    ];
    const supabase = makeSupabase(
      levelChains({
        modules: ok(modules),
        modulesContent: ok([{ id: "mc-1" }]),
        artifacts: { data: null, error: null },
      }),
    );
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.artifactsCount).toBe(0);
  });

  it("falls back to level fields when problem_statement is not an object", async () => {
    const supabase = makeSupabase(levelChains({ level: { problem_statement: "plain string" } }));
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.levelProblemStatement).toEqual({
      title: "Level One",
      description: "Level description",
    });
  });

  it("falls back when problem_statement is an array", async () => {
    const supabase = makeSupabase(levelChains({ level: { problem_statement: ["a"] } }));
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.levelProblemStatement).toEqual({
      title: "Level One",
      description: "Level description",
    });
  });

  it("normalizes a problem statement with valid title and description", async () => {
    const supabase = makeSupabase(
      levelChains({
        level: { problem_statement: { title: "  Problem  ", description: "  Statement  " } },
      }),
    );
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.levelProblemStatement).toEqual({ title: "Problem", description: "Statement" });
  });

  it("falls back per field when problem statement fields are invalid", async () => {
    const supabase = makeSupabase(
      levelChains({ level: { problem_statement: { title: 123, description: 42 } } }),
    );
    const result = await getLevelWithModules(supabase, "level-1");
    expect(result?.levelProblemStatement).toEqual({
      title: "Level One",
      description: "Level description",
    });
  });
});
