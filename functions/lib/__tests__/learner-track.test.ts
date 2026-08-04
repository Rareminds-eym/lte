import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  getActiveLearningPath,
  syncUserCapabilities,
  upsertLearningPath,
  upsertLearningTrack,
} from "../../api/v1/learning-paths/queries";
import { callSkill } from "../../lib/skill-gateway";
import type { LteEnv } from "../../lib/types";
import { resolveActiveTrack } from "../learner-track";

vi.mock("@functions/lib/skill-gateway", () => ({
  callSkill: vi.fn(),
}));

vi.mock("@functions/api/v1/learning-paths/queries", () => ({
  getActiveLearningPath: vi.fn(),
  syncUserCapabilities: vi.fn(),
  upsertLearningPath: vi.fn(),
  upsertLearningTrack: vi.fn(),
  deactivateOtherPaths: vi.fn(),
}));

describe("Learner Track Resolution (3-layer logic)", () => {
  const env: LteEnv = {
    SKILLPASSPORT_INTERNAL_URL: "https://skillpassport.test",
    SKILLPASSPORT_INTERNAL_SECRET: "mock-secret-at-least-32-chars-long-here",
  } as LteEnv;
  const userId = "11111111-1111-1111-1111-111111111111";
  const mockPath = {
    learningPathId: "lp-1",
    learningTrackId: "lt-1",
    roleId: "role-1",
    track: "Backend Engineering",
    fit: "High",
    matchScore: 95,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Layer 1: LTE Local Cache", () => {
    it("should return the local active path if it already exists", async () => {
      (getActiveLearningPath as Mock).mockResolvedValue(mockPath);
      const mockSupabase = {} as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);
      expect(result).toEqual({ data: mockPath, needsAssessment: false });
      expect(getActiveLearningPath).toHaveBeenCalledWith(mockSupabase, userId);
      expect(callSkill).not.toHaveBeenCalled();
    });

    it("should search and reactivate the latest inactive path if one exists", async () => {
      (getActiveLearningPath as Mock).mockResolvedValueOnce(null); // first call: none active

      const mockInactivePath = {
        id: "lp-inactive",
        learning_track_id: "lt-1",
        role_id: "role-1",
        learning_tracks: [
          {
            track: "Backend Engineering",
            fit: "High",
            match_score: 95,
          },
        ],
      };

      const mockUpdate = vi.fn().mockResolvedValue({ error: null });
      const mockEq = vi.fn().mockImplementation(() => ({ error: null }));
      const mockOrder = vi.fn().mockImplementation(() => ({
        limit: () => ({
          maybeSingle: async () => ({ data: mockInactivePath, error: null }),
        }),
      }));

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_paths") {
            return {
              select: () => ({
                eq: () => ({
                  order: mockOrder,
                }),
              }),
              update: mockUpdate,
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      mockUpdate.mockImplementation(() => ({
        eq: mockEq,
      }));

      const result = await resolveActiveTrack(mockSupabase, env, userId);

      expect(result).toEqual({
        data: {
          learningPathId: "lp-inactive",
          learningTrackId: "lt-1",
          roleId: "role-1",
          track: "Backend Engineering",
          fit: "High",
          matchScore: 95,
        },
        needsAssessment: false,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith("learning_paths");
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: true });
      expect(mockEq).toHaveBeenCalledWith("id", "lp-inactive");
    });
  });

  describe("Layer 2: SkillPassport Gateway Sync", () => {
    it("should call Skill gateway if no local paths exist, and upsert a matched role", async () => {
      (getActiveLearningPath as Mock)
        .mockResolvedValueOnce(null) // Layer 1 active check
        .mockResolvedValueOnce(mockPath); // Refreshed retrieval after upserts

      const mockGatewayResult = {
        found: true,
        track: {
          attemptId: "att-123",
          roleId: "role-123",
          roleName: "Aerostructure documentation assistant",
          trackName: "Aerostructure Engineering Support",
          fit: "High",
          matchScore: 95,
          whyItFits: "Matches experience.",
        },
      };

      (callSkill as Mock).mockResolvedValue(mockGatewayResult);
      (upsertLearningTrack as Mock).mockResolvedValue("lt-1");
      (upsertLearningPath as Mock).mockResolvedValue("lp-1");

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          // Mock inactive path select
          if (table === "learning_paths") {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          // Mock roles catalog lookup
          if (table === "roles") {
            return {
              select: () => ({
                ilike: () => ({
                  maybeSingle: async () => ({
                    data: { id: "role-123" },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);

      expect(result).toEqual({ data: mockPath, needsAssessment: false });
      expect(callSkill).toHaveBeenCalledWith(env, "learning-track:get", { userId }, userId);
      expect(upsertLearningTrack).toHaveBeenCalledWith(mockSupabase, {
        userId,
        attemptId: "att-123",
        fit: "High",
        track: "Aerostructure Engineering Support",
        matchScore: 95,
        whyItFits: "Matches experience.",
      });
      expect(upsertLearningPath).toHaveBeenCalledWith(mockSupabase, {
        userId,
        trackId: "lt-1",
        roleId: "role-123",
        isActive: true,
      });
      expect(syncUserCapabilities).toHaveBeenCalledWith(mockSupabase, {
        userId,
        learningPathId: "lp-1",
        roleId: "role-123",
      });
    });

    it("should call Skill gateway and upsert all 3 tracks returned in tracks array", async () => {
      (getActiveLearningPath as Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(mockPath);

      const mockGatewayResult = {
        found: true,
        tracks: [
          {
            attemptId: "att-123",
            roleId: "role-high",
            roleName: "High Fit Track",
            trackName: "High Fit Cluster",
            fit: "High",
            matchScore: 90,
            whyItFits: "Fits high.",
          },
          {
            attemptId: "att-123",
            roleId: "role-medium",
            roleName: "Medium Fit Track",
            trackName: "Medium Fit Cluster",
            fit: "Medium",
            matchScore: 70,
            whyItFits: "Fits medium.",
          },
          {
            attemptId: "att-123",
            roleId: "role-explore",
            roleName: "Explore Fit Track",
            trackName: "Explore Fit Cluster",
            fit: "Explore",
            matchScore: 50,
            whyItFits: "Fits explore.",
          },
        ],
      };

      (callSkill as Mock).mockResolvedValue(mockGatewayResult);
      (upsertLearningTrack as Mock)
        .mockResolvedValueOnce("lt-high")
        .mockResolvedValueOnce("lt-medium")
        .mockResolvedValueOnce("lt-explore");
      (upsertLearningPath as Mock)
        .mockResolvedValueOnce("lp-high")
        .mockResolvedValueOnce("lp-medium")
        .mockResolvedValueOnce("lp-explore");

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_paths") {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);

      expect(result).toEqual({ data: mockPath, needsAssessment: false });
      expect(callSkill).toHaveBeenCalledWith(env, "learning-track:get", { userId }, userId);

      // Verify upserts for each of the three tracks
      expect(upsertLearningTrack).toHaveBeenNthCalledWith(1, mockSupabase, {
        userId,
        attemptId: "att-123",
        fit: "High",
        track: "High Fit Cluster",
        matchScore: 90,
        whyItFits: "Fits high.",
      });
      expect(upsertLearningTrack).toHaveBeenNthCalledWith(2, mockSupabase, {
        userId,
        attemptId: "att-123",
        fit: "Medium",
        track: "Medium Fit Cluster",
        matchScore: 70,
        whyItFits: "Fits medium.",
      });
      expect(upsertLearningTrack).toHaveBeenNthCalledWith(3, mockSupabase, {
        userId,
        attemptId: "att-123",
        fit: "Explore",
        track: "Explore Fit Cluster",
        matchScore: 50,
        whyItFits: "Fits explore.",
      });

      // Verify path upserts (only first is active)
      expect(upsertLearningPath).toHaveBeenNthCalledWith(1, mockSupabase, {
        userId,
        trackId: "lt-high",
        roleId: "role-high",
        isActive: true,
      });
      expect(upsertLearningPath).toHaveBeenNthCalledWith(2, mockSupabase, {
        userId,
        trackId: "lt-medium",
        roleId: "role-medium",
        isActive: false,
      });
      expect(upsertLearningPath).toHaveBeenNthCalledWith(3, mockSupabase, {
        userId,
        trackId: "lt-explore",
        roleId: "role-explore",
        isActive: false,
      });

      // Verify syncUserCapabilities only called for the active track (first)
      expect(syncUserCapabilities).toHaveBeenCalledTimes(1);
      expect(syncUserCapabilities).toHaveBeenCalledWith(mockSupabase, {
        userId,
        learningPathId: "lp-high",
        roleId: "role-high",
      });
    });
  });

  describe("Layer 3: Graceful Fallback", () => {
    it("should return needsAssessment: true if gateway returns found: false", async () => {
      (getActiveLearningPath as Mock).mockResolvedValue(null);
      (callSkill as Mock).mockResolvedValue({ found: false });

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        })),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);
      expect(result).toEqual({ data: null, needsAssessment: true });
    });

    it("should return needsAssessment: true and log warning if gateway call fails", async () => {
      (getActiveLearningPath as Mock).mockResolvedValue(null);
      (callSkill as Mock).mockRejectedValue(new Error("Gateway timeout"));

      const mockSupabase = {
        from: vi.fn().mockImplementation(() => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        })),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);
      expect(result).toEqual({ data: null, needsAssessment: true });
    });
  });
});
