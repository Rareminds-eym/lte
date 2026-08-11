import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  deactivateOtherTracks,
  getActiveLearningTrack,
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
  getActiveLearningTrack: vi.fn(),
  syncUserCapabilities: vi.fn(),
  upsertLearningPath: vi.fn(),
  upsertLearningTrack: vi.fn(),
  deactivateOtherTracks: vi.fn(),
}));

describe("Learner Track Resolution (3-layer logic)", () => {
  const env: LteEnv = {
    SKILLPASSPORT_INTERNAL_URL: "https://skillpassport.test",
    SKILLPASSPORT_INTERNAL_SECRET: "mock-secret-at-least-32-chars-long-here",
  } as LteEnv;
  const userId = "11111111-1111-1111-1111-111111111111";
  const mockPath = {
    learningTrackId: "lt-1",
    track: "Backend Engineering",
    fit: "High",
    matchScore: 95,
    whyItFits: "Matches experience.",
    roles: [
      {
        roleId: "role-1",
        roleName: "Backend Engineer",
        learningPathId: "lp-1",
      },
    ],
    tracks: [],
    overallProgress: 0,
    completionCount: 0,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Layer 1: LTE Local Cache", () => {
    it("should return the local active track if it already exists", async () => {
      (getActiveLearningTrack as Mock).mockResolvedValueOnce(mockPath);

      const mockSupabase = {} as SupabaseClient;
      const result = await resolveActiveTrack(mockSupabase, env, userId);

      expect(result).toEqual({ data: mockPath, needsAssessment: false });
      expect(getActiveLearningTrack).toHaveBeenCalledWith(mockSupabase, userId);
    });

    it("should search for inactive track, reactivate it and return reactivated track", async () => {
      (getActiveLearningTrack as Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(mockPath);

      const mockEq = vi.fn().mockImplementation((col) => {
        if (col === "user_id") {
          return {
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: async () => ({
                  data: {
                    id: "lt-inactive",
                    track: "Backend Engineering",
                    fit: "High",
                    match_score: 95,
                    why_it_fits: "Good match",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return Promise.resolve({ error: null });
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "learning_tracks") {
            return {
              select: () => ({
                eq: mockEq,
              }),
              update: mockUpdate,
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);

      expect(result).toEqual({
        data: mockPath,
        needsAssessment: false,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith("learning_tracks");
      expect(mockUpdate).toHaveBeenCalledWith({ is_active: true });
      expect(mockEq).toHaveBeenCalledWith("id", "lt-inactive");
    });
  });

  describe("Layer 2: SkillPassport Gateway Sync", () => {
    it("should call Skill gateway if no local paths exist, and upsert a matched role", async () => {
      (getActiveLearningTrack as Mock)
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
          // Mock inactive track select
          if (table === "learning_tracks") {
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
        isActive: true,
      });
      expect(upsertLearningPath).toHaveBeenCalledWith(mockSupabase, {
        userId,
        trackId: "lt-1",
        roleId: "role-123",
        metadata: {},
      });
      expect(syncUserCapabilities).toHaveBeenCalledWith(mockSupabase, {
        userId,
        learningPathId: "lp-1",
        roleId: "role-123",
      });
    });

    it("should call Skill gateway and upsert all 3 tracks returned in tracks array", async () => {
      (getActiveLearningTrack as Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(mockPath);

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
          if (table === "learning_tracks") {
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
          if (table === "roles") {
            return {
              select: () => ({
                ilike: () => ({
                  maybeSingle: async () => ({
                    data: { id: "role-mocked" },
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
      expect(deactivateOtherTracks).toHaveBeenCalledWith(mockSupabase, userId);

      expect(upsertLearningTrack).toHaveBeenNthCalledWith(1, mockSupabase, {
        userId,
        attemptId: "att-123",
        fit: "High",
        track: "High Fit Cluster",
        matchScore: 90,
        whyItFits: "Fits high.",
        isActive: true, // Primary recommendation gets isActive = true
      });

      expect(upsertLearningTrack).toHaveBeenNthCalledWith(2, mockSupabase, {
        userId,
        attemptId: "att-123",
        fit: "Medium",
        track: "Medium Fit Cluster",
        matchScore: 70,
        whyItFits: "Fits medium.",
        isActive: false,
      });

      expect(upsertLearningPath).toHaveBeenCalledTimes(3);
      expect(syncUserCapabilities).toHaveBeenCalledTimes(1); // Only synced for primary track
    });
  });

  describe("Layer 3: Graceful Degraded Mode (Gateway Error Fallback)", () => {
    it("should fallback to needsAssessment: true if gateway fails", async () => {
      (getActiveLearningTrack as Mock).mockResolvedValueOnce(null);

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      (callSkill as Mock).mockRejectedValue(new Error("Timeout calling gateway."));

      const result = await resolveActiveTrack(mockSupabase, env, userId);

      expect(result).toEqual({ data: null, needsAssessment: true });
    });
  });

  describe("resolveRoleId Fallbacks & Edge Cases", () => {
    it("should resolve roleId using contains match when exact match fails", async () => {
      (getActiveLearningTrack as Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(mockPath);
      (upsertLearningTrack as Mock).mockResolvedValue("lt-1");
      (upsertLearningPath as Mock).mockResolvedValue("lp-1");

      const mockGatewayResult = {
        found: true,
        track: {
          attemptId: "att-123",
          roleName: "Aerostructure doc assistant",
          trackName: "Aerostructure Engineering Support",
          fit: "High",
          matchScore: 95,
          whyItFits: "Matches experience.",
        },
      };
      (callSkill as Mock).mockResolvedValue(mockGatewayResult);

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "roles") {
            const chain = {
              select: () => chain,
              ilike: vi.fn().mockImplementation((_col, val) => {
                if (val === "Aerostructure doc assistant") {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                }
                return {
                  limit: () => ({
                    maybeSingle: async () => ({ data: { id: "contains-role-id" }, error: null }),
                  }),
                };
              }),
            };
            return chain;
          }
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
        }),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);
      expect(result.data).not.toBeNull();
    });

    it("should escape special characters in roleName when resolving the contains match", async () => {
      (getActiveLearningTrack as Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(mockPath);
      (upsertLearningTrack as Mock).mockResolvedValue("lt-1");
      (upsertLearningPath as Mock).mockResolvedValue("lp-1");

      const mockGatewayResult = {
        found: true,
        track: {
          attemptId: "att-123",
          roleName: "100%_Data\\Engineer",
          trackName: "Aerostructure Engineering Support",
          fit: "High",
          matchScore: 95,
          whyItFits: "Matches experience.",
        },
      };
      (callSkill as Mock).mockResolvedValue(mockGatewayResult);

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "roles") {
            const chain = {
              select: () => chain,
              ilike: vi.fn().mockImplementation((_col: string, val: string) => {
                // Exact-match request: no role found.
                if (val === "100%_Data\\Engineer") {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                }
                // Contains-match request with escaped value: found.
                return {
                  limit: () => ({
                    maybeSingle: async () => ({ data: { id: "escaped-role-id" }, error: null }),
                  }),
                };
              }),
            };
            return chain;
          }
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
        }),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);
      expect(result.data).not.toBeNull();
    });

    it("should resolve roleId using fallback limit when both exact and contains match fail", async () => {
      (getActiveLearningTrack as Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(mockPath);
      (upsertLearningTrack as Mock).mockResolvedValue("lt-1");
      (upsertLearningPath as Mock).mockResolvedValue("lp-1");

      const mockGatewayResult = {
        found: true,
        track: {
          attemptId: "att-123",
          roleName: "Non-existent role",
          trackName: "Aerostructure Engineering Support",
          fit: "High",
          matchScore: 95,
          whyItFits: "Matches experience.",
        },
      };
      (callSkill as Mock).mockResolvedValue(mockGatewayResult);

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "roles") {
            const chain = {
              select: () => chain,
              ilike: vi.fn().mockReturnValue({
                maybeSingle: async () => ({ data: null, error: null }),
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              limit: () => ({
                maybeSingle: async () => ({ data: { id: "fallback-role-id" }, error: null }),
              }),
            };
            return chain;
          }
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
        }),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);
      expect(result.data).not.toBeNull();
    });

    it("should throw error when resolveRoleId cannot find any roles in catalog", async () => {
      (getActiveLearningTrack as Mock).mockResolvedValueOnce(null);

      const mockGatewayResult = {
        found: true,
        track: {
          attemptId: "att-123",
          roleName: "Non-existent role",
          trackName: "Aerostructure Engineering Support",
          fit: "High",
          matchScore: 95,
          whyItFits: "Matches experience.",
        },
      };
      (callSkill as Mock).mockResolvedValue(mockGatewayResult);

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "roles") {
            const chain = {
              select: () => chain,
              ilike: vi.fn().mockReturnValue({
                maybeSingle: async () => ({ data: null, error: null }),
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            };
            return chain;
          }
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
        }),
      } as unknown as SupabaseClient;

      const result = await resolveActiveTrack(mockSupabase, env, userId);
      expect(result).toEqual({ data: null, needsAssessment: true });
    });
  });
});
