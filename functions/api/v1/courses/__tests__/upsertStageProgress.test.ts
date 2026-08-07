import { describe, expect, it } from "vitest";
import { upsertStageProgress } from "../queries";
import {
  err,
  makeSupabase,
  mockChain,
  ok,
  SIX_STAGES,
  stageProgressChains,
  upsertUpstream,
} from "./helpers";

describe("upsertStageProgress", () => {
  it("throws on an invalid stage name", async () => {
    const supabase = makeSupabase(stageProgressChains());
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "bogus"),
    ).rejects.toThrow("Invalid stage name: bogus");
  });

  it("updates an existing in_progress stage to completed and recalculates stats", async () => {
    const usp = mockChain({
      maybeSingle: ok({ id: "sp-1", status: "in_progress" }),
      insert: ok({ id: "sp-new" }),
      thenQueue: [
        ok([{ stage_name: "engage" }]),
        { data: null, error: null },
        ok([{ stage_name: "engage" }, { stage_name: "explore" }]),
      ],
    });
    const ump = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "mod-prog-1" }),
      thenQueue: [{ data: null, error: null }],
    });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      modules: mockChain({ single: ok({ id: "mod-1" }) }),
      user_module_progress: ump,
      user_stage_progress: usp,
    });
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "explore", "completed"),
    ).resolves.toEqual({ stageProgressId: "sp-1", stagesCompleted: 2, completionPercentage: 33 });
    expect(usp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        completed_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    expect(ump.update).toHaveBeenCalledWith(
      expect.objectContaining({
        current_stage: "explore",
        stages_completed: 2,
        completion_percentage: 33,
      }),
    );
  });

  it("skips the update when the existing stage is already completed", async () => {
    const usp = mockChain({
      maybeSingle: ok({ id: "sp-1", status: "completed" }),
      insert: ok({ id: "sp-new" }),
      thenQueue: [ok([{ stage_name: "engage" }])],
    });
    const ump = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "mod-prog-1" }),
      thenQueue: [{ data: null, error: null }],
    });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      modules: mockChain({ single: ok({ id: "mod-1" }) }),
      user_module_progress: ump,
      user_stage_progress: usp,
    });
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "explore", "completed"),
    ).resolves.toEqual({ stageProgressId: "sp-1", stagesCompleted: 0, completionPercentage: 0 });
    expect(usp.update).not.toHaveBeenCalled();
  });

  it("throws when updating the existing stage to completed fails", async () => {
    const supabase = makeSupabase(
      stageProgressChains({
        existing: ok({ id: "sp-1", status: "in_progress" }),
        stageThenQueue: [ok([{ stage_name: "engage" }]), err("update down")],
      }),
    );
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "explore", "completed"),
    ).rejects.toThrow("Failed to update stage progress: update down");
  });

  it("adds duration seconds to an existing stage progress record", async () => {
    const usp = mockChain({
      maybeSingle: ok({ id: "sp-1", status: "in_progress", time_spent_seconds: 10 }),
      insert: ok({ id: "sp-new" }),
      thenQueue: [ok([]), { data: null, error: null }, ok([])],
    });
    const ump = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "mod-prog-1" }),
      thenQueue: [{ data: null, error: null }],
    });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      modules: mockChain({ single: ok({ id: "mod-1" }) }),
      user_module_progress: ump,
      user_stage_progress: usp,
    });

    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "engage", "in_progress", 25),
    ).resolves.toEqual({ stageProgressId: "sp-1", stagesCompleted: 0, completionPercentage: 0 });

    expect(usp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        time_spent_seconds: 35,
        last_viewed_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
  });

  it("throws when inserting a new stage progress fails", async () => {
    const supabase = makeSupabase(
      stageProgressChains({ existing: { data: null, error: null }, insert: err("insert down") }),
    );
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "engage", "completed"),
    ).rejects.toThrow("Failed to insert stage progress: insert down");
  });

  it("inserts a new stage progress with the default status", async () => {
    const usp = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "sp-new" }),
      thenQueue: [{ data: null, error: null }],
    });
    const ump = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "mod-prog-1" }),
      thenQueue: [{ data: null, error: null }],
    });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      modules: mockChain({ single: ok({ id: "mod-1" }) }),
      user_module_progress: ump,
      user_stage_progress: usp,
    });
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "engage"),
    ).resolves.toEqual({ stageProgressId: "sp-new", stagesCompleted: 0, completionPercentage: 0 });
    expect(usp.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_module_progress_id: "mod-prog-1",
        user_id: "user-1",
        e_content_id: "ec-1",
        stage_name: "engage",
        stage_order: 1,
        status: "in_progress",
        completed_at: null,
        time_spent_seconds: 0,
        last_viewed_at: expect.any(String),
      }),
    );
    expect(ump.update).toHaveBeenCalledWith(
      expect.objectContaining({
        current_stage: "engage",
        stages_completed: 0,
        completion_percentage: 0,
      }),
    );
  });

  it("throws when fetching completed stages fails", async () => {
    const supabase = makeSupabase(
      stageProgressChains({
        existing: ok({ id: "sp-1", status: "completed" }),
        stageThenQueue: [ok([{ stage_name: "engage" }]), err("completed down")],
      }),
    );
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "explore", "completed"),
    ).rejects.toThrow("Failed to fetch completed stages for module recalculation: completed down");
  });

  it("throws when the module progress stats update fails", async () => {
    const supabase = makeSupabase(
      stageProgressChains({
        existing: ok({ id: "sp-1", status: "completed" }),
        stageThenQueue: [ok([{ stage_name: "engage" }])],
        modThenQueue: [err("mod update down")],
      }),
    );
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "explore", "completed"),
    ).rejects.toThrow("Failed to update module progress stats: mod update down");
  });

  it("finalizes module status when all six stages are completed", async () => {
    const usp = mockChain({
      maybeSingle: ok({ id: "sp-1", status: "in_progress" }),
      insert: ok({ id: "sp-new" }),
      thenQueue: [ok([{ stage_name: "engage" }]), { data: null, error: null }, ok(SIX_STAGES)],
    });
    const ump = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "mod-prog-1" }),
      thenQueue: [
        { data: null, error: null },
        { data: null, error: null },
      ],
    });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      modules: mockChain({ single: ok({ id: "mod-1" }) }),
      user_module_progress: ump,
      user_stage_progress: usp,
    });
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "explore", "completed"),
    ).resolves.toEqual({ stageProgressId: "sp-1", stagesCompleted: 6, completionPercentage: 100 });
    expect(ump.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ module_status: "completed", updated_at: expect.any(String) }),
    );
  });

  it("throws when finalizing the module status fails", async () => {
    const supabase = makeSupabase(
      stageProgressChains({
        existing: ok({ id: "sp-1", status: "in_progress" }),
        stageThenQueue: [
          ok([{ stage_name: "engage" }]),
          { data: null, error: null },
          ok(SIX_STAGES),
        ],
        modThenQueue: [{ data: null, error: null }, err("final down")],
      }),
    );
    await expect(
      upsertStageProgress(supabase, "user-1", "level-1", 1, "ec-1", "explore", "completed"),
    ).rejects.toThrow("Failed to finalize module status to completed: final down");
  });
});
