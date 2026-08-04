import { describe, expect, it } from "vitest";
import { getModuleDetails } from "../queries";
import { err, makeSupabase, moduleDetailsChains, moduleRow, ok } from "./helpers";

describe("getModuleDetails", () => {
  it("returns null when the level fetch fails", async () => {
    const supabase = makeSupabase(moduleDetailsChains({ levelResult: err("boom") }));
    await expect(getModuleDetails(supabase, "level-1", 2)).resolves.toBeNull();
  });

  it("returns null when the level data is missing without error", async () => {
    const supabase = makeSupabase(
      moduleDetailsChains({ levelResult: { data: null, error: null } }),
    );
    await expect(getModuleDetails(supabase, "level-1", 2)).resolves.toBeNull();
  });

  it("returns null when the module fetch fails", async () => {
    const supabase = makeSupabase(moduleDetailsChains({ moduleResult: err("boom") }));
    await expect(getModuleDetails(supabase, "level-1", 2)).resolves.toBeNull();
  });

  it("returns null when the module data is missing without error", async () => {
    const supabase = makeSupabase(
      moduleDetailsChains({ moduleResult: { data: null, error: null } }),
    );
    await expect(getModuleDetails(supabase, "level-1", 2)).resolves.toBeNull();
  });

  it("builds all six stages with sorted content, artifacts, and fallbacks", async () => {
    const supabase = makeSupabase(moduleDetailsChains());
    const result = await getModuleDetails(supabase, "level-1", 2);
    expect(result).not.toBeNull();
    expect(result?.levelCode).toBe("RCP-L1");
    expect(result?.levelTitle).toBe("Level One");
    expect(result?.moduleNo).toBe(2);
    expect(result?.support).toEqual({ faq: true });
    expect(result?.knowledge).toEqual({});
    expect(result?.tools).toEqual({});
    expect(result?.learningContent).toEqual({});

    expect(result?.stages.map((s) => s.stageName)).toEqual([
      "engage",
      "explore",
      "explain",
      "express",
      "empower",
      "evolve",
    ]);

    const engage = result?.stages[0];
    expect(engage).toMatchObject({
      id: "mc-2",
      stageOrder: 1,
      stageDescription: "Engage desc",
      isActive: true,
      items: [],
      artifacts: [],
    });

    const explore = result?.stages[1];
    expect(explore).toMatchObject({
      id: "virtual-explore",
      stageOrder: 2,
      stageDescription: "",
      isActive: false,
      items: [],
      artifacts: [],
    });

    const explain = result?.stages[2];
    expect(explain).toMatchObject({ id: "mc-1", stageOrder: 3, stageDescription: "" });
    expect(explain?.items.map((i) => i.id)).toEqual(["e-1", "e-2"]);
    expect(explain?.items[0]).toMatchObject({
      contentType: "video",
      title: "V1",
      sortOrder: 1,
      durationSeconds: 100,
      xpReward: 10,
      mimeType: "mp4",
      fileSizeBytes: 1000,
      status: "published",
    });
    expect(explain?.artifacts.map((a) => a.id)).toEqual(["art-1"]);
    expect(explain?.artifacts[0]?.questions.map((q) => q.id)).toEqual(["q-1", "q-2"]);
    expect(explain?.artifacts[0]?.templates).toHaveLength(1);
    expect(explain?.artifacts[0]?.templates[0]).toMatchObject({
      questionId: "q-1",
      fileName: "f.pdf",
      fileType: "pdf",
      isDownloadable: true,
    });

    const express = result?.stages[3];
    expect(express).toMatchObject({
      id: "mc-3",
      stageDescription: "",
      isActive: true,
      items: [],
      artifacts: [{ id: "art-3", questions: [], templates: [], isActive: true }],
    });

    const empower = result?.stages[4];
    expect(empower).toMatchObject({
      id: "virtual-empower",
      stageOrder: 5,
      isActive: false,
      artifacts: [],
    });

    const evolve = result?.stages[5];
    expect(evolve).toMatchObject({ id: "virtual-evolve", stageOrder: 6, isActive: false });
  });

  it("returns zero progress when no userId is provided", async () => {
    const supabase = makeSupabase(moduleDetailsChains());
    const result = await getModuleDetails(supabase, "level-1", 2);
    expect(result?.progressPercentage).toBe(0);
    expect(result?.completedStages).toEqual([]);
  });

  it("includes module progress and completed stages when userId is provided", async () => {
    const supabase = makeSupabase(
      moduleDetailsChains({
        moduleProgress: ok({ id: "mp-1", completion_percentage: 33 }),
        stagesProg: ok([{ stage_name: "Explore" }, { stage_name: "engage" }]),
      }),
    );
    const result = await getModuleDetails(supabase, "level-1", 2, "user-1");
    expect(result?.progressPercentage).toBe(33);
    expect(result?.completedStages).toEqual(["explore", "engage"]);
  });

  it("keeps progress at zero when module progress is missing", async () => {
    const supabase = makeSupabase(
      moduleDetailsChains({ moduleProgress: { data: null, error: null }, stagesProg: ok([]) }),
    );
    const result = await getModuleDetails(supabase, "level-1", 2, "user-1");
    expect(result?.progressPercentage).toBe(0);
    expect(result?.completedStages).toEqual([]);
  });

  it("creates virtual stages when modules_content is null", async () => {
    const supabase = makeSupabase(
      moduleDetailsChains({ modulesContent: { data: null, error: null } }),
    );
    const result = await getModuleDetails(supabase, "level-1", 2);
    expect(result?.stages).toHaveLength(6);
    expect(result?.stages.every((s) => s.isActive === false)).toBe(true);
    expect(result?.stages[0]?.id).toBe("virtual-engage");
    expect(result?.stages[5]?.id).toBe("virtual-evolve");
  });

  it("defaults support, knowledge, tools, and learning content to empty objects", async () => {
    const supabase = makeSupabase(
      moduleDetailsChains({ moduleResult: ok({ ...moduleRow, support: null }) }),
    );
    const result = await getModuleDetails(supabase, "level-1", 2);
    expect(result?.support).toEqual({});
    expect(result?.knowledge).toEqual({});
    expect(result?.tools).toEqual({});
    expect(result?.learningContent).toEqual({});
  });

  it("keeps completed stages empty when stages progress is null", async () => {
    const supabase = makeSupabase(
      moduleDetailsChains({
        moduleProgress: ok({ id: "mp-1", completion_percentage: 0 }),
        stagesProg: { data: null, error: null },
      }),
    );
    const result = await getModuleDetails(supabase, "level-1", 2, "user-1");
    expect(result?.progressPercentage).toBe(0);
    expect(result?.completedStages).toEqual([]);
  });
});
