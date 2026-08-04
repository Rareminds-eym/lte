import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRoleExists,
  deactivateOtherPaths,
  getActiveLearningPath,
  syncUserCapabilities,
  upsertLearningPath,
  upsertLearningTrack,
} from "../queries";

interface Resolver {
  data?: unknown;
  error?: unknown;
}

interface TableConfig {
  query?: Resolver;
  insert?: Resolver;
  update?: Resolver;
  upsert?: Resolver;
}

interface QueryChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (resolve: (val: unknown) => unknown) => Promise<unknown>;
}

function chainFor(config: Resolver): QueryChain {
  const chain: QueryChain = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    upsert: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockResolvedValue({ data: config.data, error: config.error ?? null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: config.data, error: config.error ?? null }),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: (resolve: (val: unknown) => unknown) =>
      Promise.resolve({ data: config.data, error: config.error ?? null }).then(resolve),
  };
  return chain;
}

function chainForTable(table: TableConfig): QueryChain {
  const base = chainFor(table.query ?? {});
  const insertConfig = table.insert;
  if (insertConfig) base.insert.mockImplementation(() => chainFor(insertConfig));
  const updateConfig = table.update;
  if (updateConfig) base.update.mockImplementation(() => chainFor(updateConfig));
  const upsertConfig = table.upsert;
  if (upsertConfig) base.upsert.mockImplementation(() => chainFor(upsertConfig));
  return base;
}

function supabaseWith(tables: Record<string, TableConfig>) {
  return {
    from: vi.fn().mockImplementation((table: string) => chainForTable(tables[table] ?? {})),
  } as unknown as SupabaseClient;
}

function fromChain(supabase: SupabaseClient, callIndex = 0) {
  const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
  return fromMock.mock.results[callIndex]?.value as QueryChain | undefined;
}

const uniqueViolation = { code: "23505", message: "duplicate key value" };

describe("learning-paths queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getActiveLearningPath", () => {
    it("returns null when no path exists", async () => {
      await expect(
        getActiveLearningPath(supabaseWith({ learning_paths: { query: { data: null } } }), "u1"),
      ).resolves.toBeNull();
    });

    it("maps array learning_tracks", async () => {
      const supabase = supabaseWith({
        learning_paths: {
          query: {
            data: {
              id: "lp1",
              learning_track_id: "lt1",
              role_id: "r1",
              learning_tracks: [{ track: "React", fit: "high", match_score: 87 }],
            },
          },
        },
      });

      await expect(getActiveLearningPath(supabase, "u1")).resolves.toEqual({
        learningPathId: "lp1",
        learningTrackId: "lt1",
        roleId: "r1",
        track: "React",
        fit: "high",
        matchScore: 87,
      });
    });

    it("maps object learning_tracks with null fallbacks", async () => {
      const supabase = supabaseWith({
        learning_paths: {
          query: {
            data: {
              id: "lp1",
              learning_track_id: "lt1",
              role_id: "r1",
              learning_tracks: { track: null, fit: null, match_score: null },
            },
          },
        },
      });

      await expect(getActiveLearningPath(supabase, "u1")).resolves.toEqual({
        learningPathId: "lp1",
        learningTrackId: "lt1",
        roleId: "r1",
        track: "",
        fit: "",
        matchScore: 0,
      });
    });

    it("defaults when learning_tracks is missing", async () => {
      const supabase = supabaseWith({
        learning_paths: { query: { data: { id: "lp1", learning_track_id: "lt1", role_id: "r1" } } },
      });

      await expect(getActiveLearningPath(supabase, "u1")).resolves.toEqual({
        learningPathId: "lp1",
        learningTrackId: "lt1",
        roleId: "r1",
        track: "",
        fit: "",
        matchScore: 0,
      });
    });

    it("throws when the query errors", async () => {
      const supabase = supabaseWith({ learning_paths: { query: { error: new Error("boom") } } });
      await expect(getActiveLearningPath(supabase, "u1")).rejects.toThrow(
        "Failed to fetch active learning path: boom",
      );
    });
  });

  describe("checkRoleExists", () => {
    it("returns true when the role exists", async () => {
      await expect(
        checkRoleExists(supabaseWith({ roles: { query: { data: { id: "r1" } } } }), "r1"),
      ).resolves.toBe(true);
    });

    it("returns false when the role is missing", async () => {
      await expect(
        checkRoleExists(supabaseWith({ roles: { query: { data: null } } }), "r1"),
      ).resolves.toBe(false);
    });

    it("throws when the query errors", async () => {
      const supabase = supabaseWith({ roles: { query: { error: new Error("boom") } } });
      await expect(checkRoleExists(supabase, "r1")).rejects.toThrow(
        "Failed to check role existence: boom",
      );
    });
  });

  describe("upsertLearningTrack", () => {
    const params = {
      userId: "u1",
      attemptId: "a1",
      fit: "high",
      track: "React",
      matchScore: 87,
      whyItFits: "reason",
    };

    it("inserts a new track with an explicit duration", async () => {
      const supabase = supabaseWith({ learning_tracks: { query: { data: { id: "lt1" } } } });

      const id = await upsertLearningTrack(supabase, { ...params, duration: "12 months" });
      expect(id).toBe("lt1");
      expect(fromChain(supabase)?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ duration: "12 months" }),
      );
    });

    it("defaults the duration to 6 months", async () => {
      const supabase = supabaseWith({ learning_tracks: { query: { data: { id: "lt1" } } } });

      const id = await upsertLearningTrack(supabase, params);
      expect(id).toBe("lt1");
      expect(fromChain(supabase)?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ duration: "6 months" }),
      );
    });

    it("updates the existing track on a unique violation", async () => {
      const supabase = supabaseWith({
        learning_tracks: {
          query: { data: { id: "lt1" }, error: uniqueViolation },
          update: { data: { id: "lt1-updated" } },
        },
      });

      const id = await upsertLearningTrack(supabase, params);
      expect(id).toBe("lt1-updated");
      expect(fromChain(supabase, 1)?.update).toHaveBeenCalledWith(
        expect.objectContaining({ duration: "6 months" }),
      );
    });

    it("throws when the update fails after a unique violation", async () => {
      const supabase = supabaseWith({
        learning_tracks: {
          query: { data: { id: "lt1" }, error: uniqueViolation },
          update: { error: new Error("boom") },
        },
      });

      await expect(upsertLearningTrack(supabase, params)).rejects.toThrow(
        "Failed to update learning track: boom",
      );
    });

    it("throws for other insert errors", async () => {
      const supabase = supabaseWith({
        learning_tracks: { query: { error: { code: "42P01", message: "relation missing" } } },
      });

      await expect(upsertLearningTrack(supabase, params)).rejects.toThrow(
        "Failed to upsert learning track: relation missing",
      );
    });
  });

  describe("deactivateOtherPaths", () => {
    it("deactivates active paths", async () => {
      const supabase = supabaseWith({ learning_paths: { query: { data: null } } });
      await expect(deactivateOtherPaths(supabase, "u1")).resolves.toBeUndefined();
      expect(fromChain(supabase)?.update).toHaveBeenCalledWith({ is_active: false });
    });

    it("throws when the update errors", async () => {
      const supabase = supabaseWith({ learning_paths: { query: { error: new Error("boom") } } });
      await expect(deactivateOtherPaths(supabase, "u1")).rejects.toThrow(
        "Failed to deactivate other active paths: boom",
      );
    });
  });

  describe("upsertLearningPath", () => {
    const params = { userId: "u1", trackId: "lt1", roleId: "r1" };

    it("inserts a new learning path", async () => {
      const supabase = supabaseWith({ learning_paths: { query: { data: { id: "lp1" } } } });

      const id = await upsertLearningPath(supabase, params);
      expect(id).toBe("lp1");
      expect(fromChain(supabase)?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true }),
      );
    });

    it("reactivates the existing path on a unique violation", async () => {
      const supabase = supabaseWith({
        learning_paths: {
          query: { data: { id: "lp1" }, error: uniqueViolation },
          update: { data: { id: "lp1-again" } },
        },
      });

      const id = await upsertLearningPath(supabase, params);
      expect(id).toBe("lp1-again");
    });

    it("throws when the reactivation update fails", async () => {
      const supabase = supabaseWith({
        learning_paths: {
          query: { data: { id: "lp1" }, error: uniqueViolation },
          update: { error: new Error("boom") },
        },
      });

      await expect(upsertLearningPath(supabase, params)).rejects.toThrow(
        "Failed to reactivate learning path: boom",
      );
    });

    it("throws for other insert errors", async () => {
      const supabase = supabaseWith({
        learning_paths: { query: { error: { code: "42P01", message: "relation missing" } } },
      });

      await expect(upsertLearningPath(supabase, params)).rejects.toThrow(
        "Failed to upsert learning path: relation missing",
      );
    });
  });

  describe("syncUserCapabilities", () => {
    it("returns early when the role has no capability sequences", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: { query: { data: [] } },
        user_capabilities: { query: { data: null }, upsert: { data: null } },
      });

      await expect(
        syncUserCapabilities(supabase, { userId: "u1", learningPathId: "lp1", roleId: "r1" }),
      ).resolves.toBeUndefined();
      expect(supabase.from).not.toHaveBeenCalledWith("user_capabilities");
    });

    it("builds upsert rows with gaps and scores", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: {
          query: {
            data: [
              { id: "s1", required_level: "L3" },
              { id: "s2", required_level: "weird" },
              { id: "s3", required_level: "L1" },
            ],
          },
        },
        user_capabilities: {
          query: {
            data: [
              { role_sequence_id: "s1", current_level: 1 },
              { role_sequence_id: "s3", current_level: 2 },
            ],
          },
          upsert: { data: null },
        },
      });

      await syncUserCapabilities(supabase, { userId: "u1", learningPathId: "lp1", roleId: "r1" });

      const upsert = fromChain(supabase, 2)?.upsert;
      expect(upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role_sequence_id: "s1",
            current_level: 1,
            required_level: 3,
            gap: 2,
            has_gap: true,
            gap_score: 33,
          }),
          expect.objectContaining({
            role_sequence_id: "s2",
            current_level: 0,
            required_level: 1,
            gap: 1,
            gap_score: 0,
          }),
          expect.objectContaining({
            role_sequence_id: "s3",
            current_level: 2,
            required_level: 1,
            gap: 0,
            has_gap: false,
            gap_score: 200,
          }),
        ]),
        { onConflict: "user_id,role_sequence_id" },
      );
    });

    it("defaults when existing capabilities data is missing", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: { query: { data: [{ id: "s1", required_level: "L5" }] } },
        user_capabilities: { query: { data: null }, upsert: { data: null } },
      });

      await syncUserCapabilities(supabase, { userId: "u1", learningPathId: "lp1", roleId: "r1" });

      const upsert = fromChain(supabase, 2)?.upsert;
      expect(upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role_sequence_id: "s1",
            current_level: 0,
            required_level: 5,
            gap: 5,
            gap_score: 0,
          }),
        ]),
        expect.anything(),
      );
    });

    it("throws when the sequence query errors", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: { query: { error: new Error("boom") } },
      });
      await expect(
        syncUserCapabilities(supabase, { userId: "u1", learningPathId: "lp1", roleId: "r1" }),
      ).rejects.toThrow("Failed to query role capability sequences: boom");
    });

    it("throws when the existing capabilities query errors", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: { query: { data: [{ id: "s1", required_level: "L1" }] } },
        user_capabilities: { query: { error: new Error("boom") } },
      });
      await expect(
        syncUserCapabilities(supabase, { userId: "u1", learningPathId: "lp1", roleId: "r1" }),
      ).rejects.toThrow("Failed to query existing user capabilities: boom");
    });

    it("throws when the upsert errors", async () => {
      const supabase = supabaseWith({
        role_capability_sequence: { query: { data: [{ id: "s1", required_level: "L1" }] } },
        user_capabilities: { query: { data: null }, upsert: { error: new Error("boom") } },
      });
      await expect(
        syncUserCapabilities(supabase, { userId: "u1", learningPathId: "lp1", roleId: "r1" }),
      ).rejects.toThrow("Failed to upsert user capabilities: boom");
    });
  });
});
