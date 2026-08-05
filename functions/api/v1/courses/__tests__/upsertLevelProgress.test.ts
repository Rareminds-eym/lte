import { describe, expect, it } from "vitest";
import { upsertLevelProgress } from "../queries";
import { err, makeSupabase, mockChain, ok, upsertUpstream } from "./helpers";

describe("upsertLevelProgress", () => {
  it("throws when the learning path query fails", async () => {
    const chains = {
      learning_paths: mockChain({ maybeSingle: err("path down") }),
      levels: mockChain({
        single: ok({ id: "level-1", level_code: "RCP-L1", capability_id: "cap-1" }),
      }),
    };
    await expect(upsertLevelProgress(makeSupabase(chains), "user-1", "level-1")).rejects.toThrow(
      "Failed to query active learning path: path down",
    );
  });

  it("throws when no active learning path exists", async () => {
    const chains = {
      learning_paths: mockChain({ maybeSingle: { data: null, error: null } }),
      levels: mockChain({
        single: ok({ id: "level-1", level_code: "RCP-L1", capability_id: "cap-1" }),
      }),
    };
    await expect(upsertLevelProgress(makeSupabase(chains), "user-1", "level-1")).rejects.toThrow(
      "No active learning path found for this user",
    );
  });

  it("throws when the level fetch fails", async () => {
    const chains = { ...upsertUpstream(), levels: mockChain({ single: err("level down") }) };
    await expect(upsertLevelProgress(makeSupabase(chains), "user-1", "level-1")).rejects.toThrow(
      "Level with id 'level-1' not found: level down",
    );
  });

  it("throws when the level data is missing without an error", async () => {
    const chains = {
      ...upsertUpstream(),
      levels: mockChain({ single: { data: null, error: null } }),
    };
    await expect(upsertLevelProgress(makeSupabase(chains), "user-1", "level-1")).rejects.toThrow(
      "Level with id 'level-1' not found",
    );
  });

  it("updates existing not_started progress to in_progress with the default status", async () => {
    const upcl = mockChain({
      maybeSingle: ok({ id: "lp-1", status: "not_started" }),
      thenQueue: [{ data: null, error: null }],
    });
    const supabase = makeSupabase({ ...upsertUpstream(), user_capability_level_progress: upcl });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1")).resolves.toBe("lp-1");
    expect(upcl.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "in_progress",
        started_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
  });

  it("returns the existing id without updating for other statuses", async () => {
    const upcl = mockChain({ maybeSingle: ok({ id: "lp-1", status: "completed" }) });
    const supabase = makeSupabase({ ...upsertUpstream(), user_capability_level_progress: upcl });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1")).resolves.toBe("lp-1");
    await expect(upsertLevelProgress(supabase, "user-1", "level-1", "completed")).resolves.toBe(
      "lp-1",
    );
    expect(upcl.update).not.toHaveBeenCalled();
  });

  it("throws when the existing progress update fails", async () => {
    const upcl = mockChain({
      maybeSingle: ok({ id: "lp-1", status: "not_started" }),
      thenQueue: [err("update down")],
    });
    const supabase = makeSupabase({ ...upsertUpstream(), user_capability_level_progress: upcl });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1")).rejects.toThrow(
      "Failed to update level progress status: update down",
    );
  });

  it("throws when fetching existing progress fails", async () => {
    const upcl = mockChain({ maybeSingle: err("fetch down") });
    const supabase = makeSupabase({ ...upsertUpstream(), user_capability_level_progress: upcl });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1")).rejects.toThrow(
      "Failed to query level progress: fetch down",
    );
  });

  it("throws when the role capability sequence query fails", async () => {
    const chains = {
      ...upsertUpstream(),
      role_capability_sequence: mockChain({ maybeSingle: err("seq down") }),
    };
    await expect(upsertLevelProgress(makeSupabase(chains), "user-1", "level-1")).rejects.toThrow(
      "Failed to query role capability sequence: seq down",
    );
  });

  it("inserts new progress with computed values and default status", async () => {
    const upcl = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "lvl-prog-1" }),
    });
    const seq = mockChain({
      maybeSingle: ok({ id: "seq-1", required_level: "L3", capability_priority: "core" }),
    });
    const uc = mockChain({ maybeSingle: ok({ current_level: 1 }) });
    const supabase = makeSupabase({
      ...upsertUpstream("RCP-L2"),
      user_capability_level_progress: upcl,
      role_capability_sequence: seq,
      user_capabilities: uc,
    });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1")).resolves.toBe("lvl-prog-1");
    expect(upcl.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        learning_path_id: "path-1",
        level_id: "level-1",
        sequence_no: 2,
        from_level: 1,
        to_level: 2,
        current_level: 1,
        required_level: 3,
        gap: 2,
        has_gap: true,
        gap_score: 33,
        priority_band: "core",
        status: "in_progress",
        badge: "none",
        completion_percentage: 0,
      }),
    );
  });

  it("inserts with defaults when sequence data is missing and level code has no number", async () => {
    const upcl = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "lvl-prog-1" }),
    });
    const supabase = makeSupabase({
      ...upsertUpstream("RCP"),
      user_capability_level_progress: upcl,
    });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1", "completed")).resolves.toBe(
      "lvl-prog-1",
    );
    expect(upcl.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        sequence_no: 1,
        from_level: 0,
        to_level: 1,
        current_level: 0,
        required_level: 1,
        gap: 1,
        has_gap: true,
        gap_score: 0,
        priority_band: "none",
        status: "completed",
      }),
    );
  });

  it("handles sequence data without capability record and unknown required level", async () => {
    const upcl = mockChain({
      maybeSingle: { data: null, error: null },
      insert: ok({ id: "lvl-prog-1" }),
    });
    const seq = mockChain({
      maybeSingle: ok({ id: "seq-1", required_level: "L9", capability_priority: null }),
    });
    const uc = mockChain({ maybeSingle: { data: null, error: null } });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      user_capability_level_progress: upcl,
      role_capability_sequence: seq,
      user_capabilities: uc,
    });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1")).resolves.toBe("lvl-prog-1");
    expect(upcl.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        required_level: 1,
        current_level: 0,
        gap: 1,
        gap_score: 0,
        priority_band: "none",
      }),
    );
  });

  it("throws when the user capabilities query fails", async () => {
    const seq = mockChain({
      maybeSingle: ok({ id: "seq-1", required_level: "L1", capability_priority: "core" }),
    });
    const uc = mockChain({ maybeSingle: err("cap down") });
    const supabase = makeSupabase({
      ...upsertUpstream(),
      role_capability_sequence: seq,
      user_capabilities: uc,
    });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1")).rejects.toThrow(
      "Failed to query user capabilities: cap down",
    );
  });

  it("throws when inserting level progress fails", async () => {
    const upcl = mockChain({
      maybeSingle: { data: null, error: null },
      insert: err("insert down"),
    });
    const supabase = makeSupabase({ ...upsertUpstream(), user_capability_level_progress: upcl });
    await expect(upsertLevelProgress(supabase, "user-1", "level-1")).rejects.toThrow(
      "Failed to insert level progress: insert down",
    );
  });
});
