import { describe, expect, it } from "vitest";
import { upsertModuleProgress } from "../queries";
import { err, makeSupabase, mockChain, moduleProgressChains, ok, upsertUpstream } from "./helpers";

describe("upsertModuleProgress", () => {
  it("throws when the module fetch fails", async () => {
    const supabase = makeSupabase(moduleProgressChains({ modules: err("module down") }));
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1)).rejects.toThrow(
      "Module 1 for level 'level-1' not found: module down",
    );
  });

  it("throws when the module data is missing without an error", async () => {
    const supabase = makeSupabase(moduleProgressChains({ modules: { data: null, error: null } }));
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1)).rejects.toThrow(
      "Module 1 for level 'level-1' not found",
    );
  });

  it("updates existing not_started progress to in_progress with the default status", async () => {
    const ump = mockChain({
      maybeSingle: ok({ id: "mp-1", module_status: "not_started" }),
      insert: ok({ id: "mp-new" }),
      thenQueue: [{ data: null, error: null }],
    });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      modules: mockChain({ single: ok({ id: "mod-1" }) }),
      user_module_progress: ump,
    });
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1)).resolves.toBe("mp-1");
    expect(ump.update).toHaveBeenCalledWith(
      expect.objectContaining({
        module_status: "in_progress",
        last_activity_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
  });

  it("returns the existing id without updating for other statuses", async () => {
    const ump = mockChain({
      maybeSingle: ok({ id: "mp-1", module_status: "completed" }),
      insert: ok({ id: "mp-new" }),
      thenQueue: [{ data: null, error: null }],
    });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      modules: mockChain({ single: ok({ id: "mod-1" }) }),
      user_module_progress: ump,
    });
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1)).resolves.toBe("mp-1");
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1, "completed")).resolves.toBe(
      "mp-1",
    );
    expect(ump.update).not.toHaveBeenCalled();
  });

  it("throws when fetching module progress fails", async () => {
    const supabase = makeSupabase(moduleProgressChains({ existing: err("fetch down") }));
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1)).rejects.toThrow(
      "Failed to query module progress: fetch down",
    );
  });

  it("throws when the existing progress update fails", async () => {
    const supabase = makeSupabase(
      moduleProgressChains({
        existing: ok({ id: "mp-1", module_status: "not_started" }),
        thenQueue: [err("update down")],
      }),
    );
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1)).rejects.toThrow(
      "Failed to update module progress status: update down",
    );
  });

  it("inserts new module progress and returns its id", async () => {
    const ump = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "mp-new" }),
      thenQueue: [{ data: null, error: null }],
    });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      modules: mockChain({ single: ok({ id: "mod-1" }) }),
      user_module_progress: ump,
    });
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1, "completed")).resolves.toBe(
      "mp-new",
    );
    expect(ump.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        user_capability_level_progress_id: "lvl-prog-1",
        module_id: "mod-1",
        module_status: "completed",
        current_stage: "engage",
        stages_completed: 0,
        completion_percentage: 0,
        artifact_submitted: false,
        artifact_approval_status: "not_submitted",
      }),
    );
  });

  it("throws when inserting module progress fails", async () => {
    const supabase = makeSupabase(moduleProgressChains({ insert: err("insert down") }));
    await expect(upsertModuleProgress(supabase, "user-1", "level-1", 1)).rejects.toThrow(
      "Failed to insert module progress: insert down",
    );
  });
});
