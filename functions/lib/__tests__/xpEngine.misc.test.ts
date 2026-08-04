import { beforeEach, describe, expect, it } from "vitest";
import {
  adminOverrideArtifact,
  calculateReadiness,
  completeCapability,
  completeCourseOnTime,
  completeProfile,
  evaluateMilestones,
  generateIdempotencyKey,
  getUserTotalXp,
  triggerDailyLogin,
} from "../xp-engine";
import { createMockQueryChain, mockInsert, mockSupabase, resetMocks } from "./xpEngine.helpers";

describe("XP Engine Core logic", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("generateIdempotencyKey", () => {
    it.each([
      ["stage_completed", "stage:u:s"],
      ["practice_artifact_accepted", "practice:u:s"],
      ["practice_artifact_failed", "practice_fail:u:s"],
      ["final_artifact_accepted_1", "final:u:s"],
      ["final_artifact_accepted_2", "final:u:s"],
      ["final_artifact_accepted_3", "final:u:s"],
      ["final_artifact_failed", "final_fail:u:s"],
      ["manual_eval_accepted", "manual:u:s"],
      ["fallback_eval_failed", "fallback_fail:u:s"],
      ["course_completed_on_time", "course:u:s"],
      ["fast_track_capability", "fasttrack:u:s"],
      ["capstone_completed", "capstone:u:s"],
      ["daily_login", "login:u:s"],
      ["profile_completed", "profile:u"],
      ["streak_7_day", "streak7:u:s"],
      ["consistency_30_day", "consistency30:u:s"],
      ["readiness_milestone_25", "milestone25:u:s"],
      ["readiness_milestone_50", "milestone50:u:s"],
      ["readiness_milestone_75", "milestone75:u:s"],
      ["readiness_milestone_100", "milestone100:u:s"],
      ["legacy_consistency_bonus", "legacy_bonus:u"],
      ["promotional_xp", "promo:u:s"],
    ] as const)("should build the key for %s", (eventType, expected) => {
      expect(generateIdempotencyKey("u", eventType, "s")).toBe(expected);
    });

    it("should fall back to a generic key for unknown event types", () => {
      expect(generateIdempotencyKey("u", "unknown_event", "s")).toBe("generic:u:unknown_event:s");
    });
  });

  describe("completeCourseOnTime", () => {
    it("should award +10 course completion XP", async () => {
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await completeCourseOnTime(
        mockSupabase,
        "user-1",
        "lvl-progress-1",
        "course-1",
      );

      expect(result).toEqual({ success: true, xpAwarded: 10 });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "course_completed_on_time",
          source_type: "user_capability_level_progress",
          source_id: "lvl-progress-1",
          xp_amount: 10,
          metadata: { course_id: "course-1" },
        }),
      );
    });
  });

  describe("completeCapability", () => {
    it("should award +15 fast-track capability XP", async () => {
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await completeCapability(
        mockSupabase,
        "user-1",
        "user-cap-1",
        "capability-1",
        false,
      );

      expect(result).toEqual({ success: true, xpAwarded: 15 });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "fast_track_capability",
          source_id: "user-cap-1",
          xp_amount: 15,
        }),
      );
    });

    it("should award configured XP for capstones", async () => {
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await completeCapability(
        mockSupabase,
        "user-1",
        "user-cap-1",
        "capability-1",
        true,
        42,
      );

      expect(result).toEqual({ success: true, xpAwarded: 42 });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: "capstone_completed", xp_amount: 42 }),
      );
    });
  });

  describe("triggerDailyLogin", () => {
    it("should award +1 daily login XP", async () => {
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await triggerDailyLogin(mockSupabase, "user-1");

      expect(result).toEqual({ success: true, xpAwarded: 1 });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "daily_login",
          source_type: "users",
          source_id: "user-1",
          xp_amount: 1,
          metadata: { login_date: expect.any(String) },
        }),
      );
    });

    it("should throw when the date cannot be derived", async () => {
      const spy = vi.spyOn(Date.prototype, "toISOString").mockReturnValue("T");

      await expect(triggerDailyLogin(mockSupabase, "user-1")).rejects.toThrow("Invalid date");
      spy.mockRestore();
    });
  });

  describe("completeProfile", () => {
    it("should award +50 profile completion XP", async () => {
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await completeProfile(mockSupabase, "user-1");

      expect(result).toEqual({ success: true, xpAwarded: 50 });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "profile_completed",
          source_type: "users",
          source_id: "user-1",
          xp_amount: 50,
          idempotency_key: "profile:user-1",
        }),
      );
    });
  });

  describe("evaluateMilestones", () => {
    it("should award all four milestones for a perfect score", async () => {
      const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 100);

      expect(result).toEqual({
        success: true,
        milestonesAwarded: [
          "readiness_milestone_25",
          "readiness_milestone_50",
          "readiness_milestone_75",
          "readiness_milestone_100",
        ],
      });
    });

    it("should award nothing below the first threshold", async () => {
      const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 10);

      expect(result).toEqual({ success: true, milestonesAwarded: [] });
    });

    it("should award only thresholds at or below the score", async () => {
      const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 25);

      expect(result).toEqual({ success: true, milestonesAwarded: ["readiness_milestone_25"] });
    });

    it("should award milestones for an intermediate score", async () => {
      const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 60);

      expect(result).toEqual({
        success: true,
        milestonesAwarded: ["readiness_milestone_25", "readiness_milestone_50"],
      });
    });

    it("should not re-award milestones that were already awarded", async () => {
      mockInsert.mockReturnValue({
        error: { code: "23505", message: "duplicate key" },
      });

      const result = await evaluateMilestones(mockSupabase, "user-1", "role-1", 100);

      expect(result).toEqual({ success: true, milestonesAwarded: [] });
    });
  });

  describe("adminOverrideArtifact", () => {
    function createAdminOverrideMock(o: {
      previousFlow?: unknown;
      flowError?: unknown;
      submission?: unknown;
      subError?: unknown;
      subDetail?: unknown;
      insertError?: unknown;
    }) {
      const calls = { flows: 0, subs: 0 };
      const flowsInsert = vi.fn();
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "artifact_evaluation_flows") {
            calls.flows++;
            if (calls.flows === 1) {
              return createMockQueryChain(o.previousFlow ?? null, o.flowError ?? null);
            }
            if (calls.flows === 2) {
              return createMockQueryChain(null);
            }
            flowsInsert.mockImplementation(() => createMockQueryChain(null, o.insertError ?? null));
            return { insert: flowsInsert };
          }
          if (table === "artifact_submissions") {
            calls.subs++;
            if (calls.subs === 1) {
              return createMockQueryChain(o.submission ?? null, o.subError ?? null);
            }
            return createMockQueryChain(o.subDetail ?? null);
          }
          return createMockQueryChain(null);
        }),
      };
      return {
        supabase: supabase as unknown as Parameters<typeof adminOverrideArtifact>[0],
        flowsInsert,
      };
    }

    it("should record a passing override and mark the module mastered", async () => {
      const { supabase, flowsInsert } = createAdminOverrideMock({
        previousFlow: { id: "flow-1", decision: "fail", score: 30 },
        submission: { artifact_id: "art-1", module_artifacts: { passing_score: 50 } },
        subDetail: { user_id: "user-1", user_module_progress_id: "mod-progress-1" },
      });

      const result = await adminOverrideArtifact(supabase, "admin-1", "sub-1", 90, "re-score");

      expect(result).toEqual({ success: true });
      expect(flowsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: "pass",
          overall_status: "accepted",
          evaluated_by: "admin-1",
          score: 90,
        }),
      );
    });

    it("should record a failing override and reset the module to in_progress", async () => {
      const { supabase, flowsInsert } = createAdminOverrideMock({
        previousFlow: { id: "flow-1", decision: "pass", score: 85 },
        submission: { artifact_id: "art-1", module_artifacts: { passing_score: 50 } },
        subDetail: { user_id: "user-1", user_module_progress_id: "mod-progress-1" },
      });

      const result = await adminOverrideArtifact(supabase, "admin-1", "sub-1", 40, "re-score");

      expect(result).toEqual({ success: true });
      expect(flowsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          decision: "fail",
          overall_status: "resubmission_required",
        }),
      );
    });

    it("should default the passing score to 60 when artifact metadata is missing", async () => {
      const { supabase, flowsInsert } = createAdminOverrideMock({
        previousFlow: { id: "flow-1", decision: "fail", score: 30 },
        submission: { artifact_id: "art-1", module_artifacts: null },
        subDetail: { user_id: "user-1", user_module_progress_id: "mod-progress-1" },
      });

      const result = await adminOverrideArtifact(supabase, "admin-1", "sub-1", 80, "re-score");

      expect(result).toEqual({ success: true });
      expect(flowsInsert).toHaveBeenCalledWith(expect.objectContaining({ decision: "pass" }));
    });

    it("should skip module status updates when submission details are missing", async () => {
      const { supabase } = createAdminOverrideMock({
        previousFlow: { id: "flow-1", decision: "pass", score: 85 },
        submission: { artifact_id: "art-1", module_artifacts: { passing_score: 50 } },
        subDetail: null,
      });

      const result = await adminOverrideArtifact(supabase, "admin-1", "sub-1", 40, "re-score");

      expect(result).toEqual({ success: true });
    });

    it("should throw when the current flow cannot be found", async () => {
      const { supabase } = createAdminOverrideMock({
        flowError: { message: "not found" },
      });

      await expect(
        adminOverrideArtifact(supabase, "admin-1", "sub-1", 90, "re-score"),
      ).rejects.toThrow("Current evaluation flow not found for submission: sub-1");
    });

    it("should throw when the current flow has no data", async () => {
      const { supabase } = createAdminOverrideMock({ previousFlow: null });

      await expect(
        adminOverrideArtifact(supabase, "admin-1", "sub-1", 90, "re-score"),
      ).rejects.toThrow("Current evaluation flow not found for submission: sub-1");
    });

    it("should throw when inserting the override flow fails", async () => {
      const { supabase } = createAdminOverrideMock({
        previousFlow: { id: "flow-1", decision: "pass", score: 85 },
        submission: { artifact_id: "art-1", module_artifacts: { passing_score: 50 } },
        subDetail: { user_id: "user-1", user_module_progress_id: "mod-progress-1" },
        insertError: { message: "insert failed" },
      });

      await expect(
        adminOverrideArtifact(supabase, "admin-1", "sub-1", 90, "re-score"),
      ).rejects.toMatchObject({ message: "insert failed" });
    });
  });

  describe("calculateReadiness", () => {
    function createReadinessMock(o: {
      modules?: unknown;
      modulesErr?: unknown;
      subs?: unknown;
      subsErr?: unknown;
      flows?: unknown;
      flowsErr?: unknown;
      xp?: unknown;
      xpErr?: unknown;
      profile?: unknown;
    }) {
      return {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "user_module_progress") {
            return createMockQueryChain(o.modules ?? null, o.modulesErr ?? null);
          }
          if (table === "artifact_submissions") {
            return createMockQueryChain(o.subs ?? null, o.subsErr ?? null);
          }
          if (table === "artifact_evaluation_flows") {
            return createMockQueryChain(o.flows ?? null, o.flowsErr ?? null);
          }
          if (table === "xp_events") {
            return createMockQueryChain(o.xp ?? null, o.xpErr ?? null);
          }
          if (table === "user_profiles") {
            return createMockQueryChain(o.profile ?? null);
          }
          return createMockQueryChain(null);
        }),
      } as unknown as Parameters<typeof calculateReadiness>[0];
    }

    it("should compute a Job Ready band for a fully prepared user", async () => {
      const mockSupabase = createReadinessMock({
        modules: [
          { id: "m1", module_status: "mastered" },
          { id: "m2", module_status: "in_progress" },
        ],
        subs: [
          { id: "s1", status: "accepted", module_artifacts: [{ artifact_type: "final" }] },
          { id: "s2", status: "accepted", module_artifacts: [{ artifact_type: "final" }] },
          { id: "s3", status: "pending", module_artifacts: [{ artifact_type: "practice" }] },
          { id: "s4", status: "pending", module_artifacts: [] },
          { id: "s5", status: "pending", module_artifacts: null },
        ],
        flows: [{ score: 80 }, { score: null }, { score: 100 }],
        xp: [{ xp_amount: 100 }],
        profile: { bio: "bio", job_title: "engineer", skills: ["typescript"] },
      });

      const result = await calculateReadiness(mockSupabase, "user-1", "path-1");

      expect(result.readinessScore).toBeGreaterThanOrEqual(80);
      expect(result.band).toBe("Job Ready");
    });

    it("should compute an Internship Ready band with partial profile completion", async () => {
      const mockSupabase = createReadinessMock({
        modules: [
          { id: "m1", module_status: "mastered" },
          { id: "m2", module_status: "in_progress" },
        ],
        subs: [{ id: "s1", status: "accepted", module_artifacts: [{ artifact_type: "final" }] }],
        flows: [{ score: 100 }],
        xp: [{ xp_amount: 0 }],
        profile: { bio: "bio", job_title: "", skills: "not-an-array" },
      });

      const result = await calculateReadiness(mockSupabase, "user-1", "path-1");

      expect(result.band).toBe("Internship Ready");
    });

    it("should compute a Learning in Progress band for a partial user", async () => {
      const mockSupabase = createReadinessMock({
        modules: [
          { id: "m1", module_status: "mastered" },
          { id: "m2", module_status: "in_progress" },
        ],
        subs: [
          { id: "s1", status: "accepted", module_artifacts: [{ artifact_type: "final" }] },
          { id: "s2", status: "rejected", module_artifacts: [{ artifact_type: "final" }] },
        ],
        flows: [],
        xp: [{ xp_amount: 40 }],
        profile: { bio: "bio", job_title: "engineer", skills: [] },
      });

      const result = await calculateReadiness(mockSupabase, "user-1", "path-1");

      expect(result.band).toBe("Learning in Progress");
    });

    it("should compute Not Ready for an empty user", async () => {
      const mockSupabase = createReadinessMock({
        modules: [],
        subs: [],
        xp: [],
        profile: null,
      });

      const result = await calculateReadiness(mockSupabase, "user-1", "path-1");

      expect(result).toEqual({ readinessScore: 0, band: "Not Ready" });
    });

    it("should not count empty or blank profile fields", async () => {
      const mockSupabase = createReadinessMock({
        modules: [],
        subs: [],
        xp: [],
        profile: { bio: "", job_title: "   ", skills: [] },
      });

      const result = await calculateReadiness(mockSupabase, "user-1", "path-1");

      expect(result.band).toBe("Not Ready");
    });

    it("should throw when the module progress query fails", async () => {
      const mockSupabase = createReadinessMock({
        modulesErr: { message: "query failed" },
      });

      await expect(calculateReadiness(mockSupabase, "user-1", "path-1")).rejects.toMatchObject({
        message: "query failed",
      });
    });

    it("should throw when the artifact submissions query fails", async () => {
      const mockSupabase = createReadinessMock({
        modules: [],
        subsErr: { message: "query failed" },
      });

      await expect(calculateReadiness(mockSupabase, "user-1", "path-1")).rejects.toMatchObject({
        message: "query failed",
      });
    });

    it("should throw when the evaluation flows query fails", async () => {
      const mockSupabase = createReadinessMock({
        modules: [],
        subs: [{ id: "s1", status: "accepted", module_artifacts: [{ artifact_type: "final" }] }],
        flowsErr: { message: "query failed" },
      });

      await expect(calculateReadiness(mockSupabase, "user-1", "path-1")).rejects.toMatchObject({
        message: "query failed",
      });
    });

    it("should throw when the XP events query fails", async () => {
      const mockSupabase = createReadinessMock({
        modules: [],
        subs: [],
        xpErr: { message: "query failed" },
      });

      await expect(calculateReadiness(mockSupabase, "user-1", "path-1")).rejects.toMatchObject({
        message: "query failed",
      });
    });
  });

  describe("getUserTotalXp", () => {
    function createXpMock(data: unknown, error: unknown = null) {
      return {
        from: vi.fn().mockImplementation(() => createMockQueryChain(data, error)),
      } as unknown as Parameters<typeof getUserTotalXp>[0];
    }

    it("should sum all XP amounts, skipping null amounts", async () => {
      const mockSupabase = createXpMock([{ xp_amount: 5 }, { xp_amount: null }, { xp_amount: 15 }]);

      await expect(getUserTotalXp(mockSupabase, "user-1")).resolves.toBe(20);
    });

    it("should return 0 when no XP events exist", async () => {
      const mockSupabase = createXpMock(null);

      await expect(getUserTotalXp(mockSupabase, "user-1")).resolves.toBe(0);
    });

    it("should throw when the XP events query fails", async () => {
      const mockSupabase = createXpMock(null, { message: "query failed" });

      await expect(getUserTotalXp(mockSupabase, "user-1")).rejects.toMatchObject({
        message: "query failed",
      });
    });
  });
});
