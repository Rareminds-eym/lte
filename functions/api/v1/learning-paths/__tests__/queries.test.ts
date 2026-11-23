import { createQueryGateway, type QueryGateway } from "@functions/lib/query-gateway";
import type {
  TrackActivationAuthorization,
  TrackActivationReservation,
} from "@functions/lib/subscription-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateLearningTrack,
  checkRoleExists,
  classifyTrackActivation,
  deactivateOtherTracks,
  ensureShadowRole,
  getActiveLearningTrack,
  readCommittedTrackActivation,
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
  gte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
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
    gte: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    range: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
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

function gatewayWith(tables: Record<string, TableConfig>): {
  gateway: QueryGateway;
  supabase: SupabaseClient;
} {
  const supabase = supabaseWith(tables);
  return { gateway: createQueryGateway(supabase), supabase };
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

  describe("getActiveLearningTrack", () => {
    it("returns null when no track exists", async () => {
      await expect(
        getActiveLearningTrack(
          gatewayWith({ learning_tracks: { query: { data: null } } }).gateway,
          "u1",
        ),
      ).resolves.toBeNull();
    });

    it("maps active track and roles correctly", async () => {
      const { gateway } = gatewayWith({
        learning_tracks: {
          query: {
            data: {
              id: "track-1",
              track: "React",
              fit: "high",
              match_score: 87,
              why_it_fits: "Good match",
            },
          },
        },
        learning_paths: {
          query: {
            data: [
              {
                id: "lp-1",
                role_id: "role-1",
                role_readiness_percentage: 10,
                status: "not_started",
                updated_at: "2026-08-11T08:00:00Z",
                roles: [{ role_name: "React Developer" }],
              },
              {
                id: "lp-2",
                role_id: "role-2",
                role_readiness_percentage: 75,
                status: "in_progress",
                updated_at: "2026-08-11T09:00:00Z",
                roles: [{ role_name: "Lead Developer" }],
              },
            ],
          },
        },
      });

      await expect(getActiveLearningTrack(gateway, "u1")).resolves.toEqual({
        learningTrackId: "track-1",
        track: "React",
        fit: "high",
        matchScore: 87,
        whyItFits: "Good match",
        roles: [
          {
            roleId: "role-2",
            roleName: "Lead Developer",
            learningPathId: "lp-2",
            readinessScore: 75,
            status: "in_progress",
            updatedAt: "2026-08-11T09:00:00Z",
            domain: "",
            metadata: {},
          },
          {
            roleId: "role-1",
            roleName: "React Developer",
            learningPathId: "lp-1",
            readinessScore: 10,
            status: "not_started",
            updatedAt: "2026-08-11T08:00:00Z",
            domain: "",
            metadata: {},
          },
        ],
        tracks: [
          {
            id: "track-1",
            title: "React",
            matchPercentage: 87,
            isExplore: false,
            isSelected: undefined,
            fit: "high",
          },
        ],
        overallProgress: 0,
        completionCount: 0,
      });
    });

    it("throws when the track query errors", async () => {
      const { gateway } = gatewayWith({
        learning_tracks: { query: { error: new Error("boom") } },
      });
      await expect(getActiveLearningTrack(gateway, "u1")).rejects.toThrow(
        "Failed to fetch active learning track: boom",
      );
    });
  });

  describe("checkRoleExists", () => {
    it("returns true when the role exists", async () => {
      await expect(
        checkRoleExists(gatewayWith({ roles: { query: { data: { id: "r1" } } } }).gateway, "r1"),
      ).resolves.toBe(true);
    });

    it("returns false when the role is missing", async () => {
      await expect(
        checkRoleExists(gatewayWith({ roles: { query: { data: null } } }).gateway, "r1"),
      ).resolves.toBe(false);
    });

    it("throws when the query errors", async () => {
      const { gateway } = gatewayWith({ roles: { query: { error: new Error("boom") } } });
      await expect(checkRoleExists(gateway, "r1")).rejects.toThrow(
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
      const { gateway, supabase } = gatewayWith({
        learning_tracks: { query: { data: { id: "lt1" } } },
      });

      const id = await upsertLearningTrack(gateway, { ...params, duration: "12 months" });
      expect(id).toBe("lt1");
      expect(fromChain(supabase)?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ duration: "12 months" }),
      );
    });

    it("defaults the duration to 6 months", async () => {
      const { gateway, supabase } = gatewayWith({
        learning_tracks: { query: { data: { id: "lt1" } } },
      });

      const id = await upsertLearningTrack(gateway, params);
      expect(id).toBe("lt1");
      expect(fromChain(supabase)?.insert).toHaveBeenCalledWith(
        expect.objectContaining({ duration: "6 months" }),
      );
    });

    it("updates the existing track on a unique violation", async () => {
      const { gateway, supabase } = gatewayWith({
        learning_tracks: {
          insert: { data: { id: "lt1" }, error: uniqueViolation },
          update: { data: [{ id: "lt1-updated" }] },
        },
      });

      const id = await upsertLearningTrack(gateway, params);
      expect(id).toBe("lt1-updated");
      expect(fromChain(supabase, 1)?.update).toHaveBeenCalledWith(
        expect.objectContaining({ duration: "6 months" }),
      );
    });

    it("throws when the update fails after a unique violation", async () => {
      const { gateway } = gatewayWith({
        learning_tracks: {
          query: { data: { id: "lt1" }, error: uniqueViolation },
          update: { error: new Error("boom") },
        },
      });

      await expect(upsertLearningTrack(gateway, params)).rejects.toThrow(
        "Failed to update learning track: boom",
      );
    });

    it("throws for other insert errors", async () => {
      const { gateway } = gatewayWith({
        learning_tracks: { query: { error: { code: "42P01", message: "relation missing" } } },
      });

      await expect(upsertLearningTrack(gateway, params)).rejects.toThrow(
        "Failed to upsert learning track: relation missing",
      );
    });
  });

  describe("deactivateOtherTracks", () => {
    it("deactivates active tracks", async () => {
      const { gateway, supabase } = gatewayWith({ learning_tracks: { query: { data: null } } });
      await expect(deactivateOtherTracks(gateway, "u1")).resolves.toBeUndefined();
      expect(fromChain(supabase)?.update).toHaveBeenCalledWith({ is_active: false });
    });

    it("throws when the update errors", async () => {
      const { gateway } = gatewayWith({
        learning_tracks: { query: { error: new Error("boom") } },
      });
      await expect(deactivateOtherTracks(gateway, "u1")).rejects.toThrow(
        "Failed to deactivate other active tracks: boom",
      );
    });
  });

  describe("activateLearningTrack", () => {
    // Synthetic owner-issued authority. This suite exercises the real gateway;
    // PostgreSQL transaction and concurrent writer behavior require owner SQL tests.
    const actorId = "10000000-0000-4000-8000-000000000001";
    const trackId = "10000000-0000-4000-8000-000000000002";
    const operationId = "10000000-0000-4000-8000-000000000003";
    const otherId = "10000000-0000-4000-8000-000000000004";
    const authorization = (): TrackActivationAuthorization => ({
      schemaVersion: 1,
      actorId,
      subject: { kind: "user", id: actorId },
      subscriptionId: "10000000-0000-4000-8000-000000000005",
      productId: "10000000-0000-4000-8000-000000000006",
      revisionId: "10000000-0000-4000-8000-000000000007",
      version: 3,
      actionKey: "learning_path.activate",
      featureKey: "learning_tracks",
      mode: "write",
      validUntil: Number.MAX_SAFE_INTEGER,
      quota: {
        period: "billing_period",
        countingEvent: "course_lte_assignment",
        periodStartsAt: 0,
        periodEndsAt: Number.MAX_SAFE_INTEGER,
        limit: 3,
      },
    });
    const reservation = (authority = authorization()): TrackActivationReservation => ({
      schemaVersion: 1,
      operationId,
      actorId,
      trackId,
      authorization: authority,
      status: "pending",
      outcome: null,
      quotaReceipt: {
        used: 1,
        command: {
          operationId,
          actorId,
          subject: { kind: "user", id: actorId },
          subscriptionId: authority.subscriptionId,
          productId: authority.productId,
          revisionId: authority.revisionId,
          version: authority.version,
          actionKey: "learning_path.activate",
          countingEvent: "course_lte_assignment",
          resourceId: operationId,
          periodStartsAt: 0,
          periodEndsAt: Number.MAX_SAFE_INTEGER,
          limit: 3,
        },
      },
    });
    const receipt = () => ({
      schemaVersion: 1,
      actorId,
      trackId,
      operationId,
      reservationId: operationId,
      subscriptionId: authorization().subscriptionId,
      productId: authorization().productId,
      revisionId: authorization().revisionId,
      version: 3,
      created: true,
      completedAt: 1000,
    });
    function activationGateway(result: Resolver) {
      const from = vi.fn(() => {
        throw new Error("Legacy activation writes are prohibited");
      });
      const rpc = vi.fn().mockResolvedValue({ data: result.data, error: result.error ?? null });
      const gateway = createQueryGateway({ from, rpc } as unknown as SupabaseClient);
      return { gateway, from, rpc };
    }

    it("calls one atomic owner RPC with authenticated actor and exact operation and authority", async () => {
      const { gateway, from, rpc } = activationGateway({ data: receipt() });
      const authority = authorization();
      await expect(
        activateLearningTrack(gateway, actorId, trackId, operationId, reservation(authority)),
      ).resolves.toEqual(receipt());
      expect(rpc).toHaveBeenCalledExactlyOnceWith("activate_reserved_subscription_learning_track", {
        p_actor: actorId,
        p_track: trackId,
        p_operation: operationId,
        p_reservation: reservation(authority),
      });
      expect(from).not.toHaveBeenCalled();
    });

    const unchanged = () => ({
      kind: "unchanged",
      actorId,
      trackId,
      operationId,
      authorization: authorization(),
      completedAt: 1000,
    });
    it("classifies an owned active target without reserving quota or mutating a resource", async () => {
      const { gateway, rpc, from } = activationGateway({ data: unchanged() });
      await expect(
        classifyTrackActivation(gateway, actorId, trackId, operationId, authorization()),
      ).resolves.toEqual(unchanged());
      expect(rpc).toHaveBeenCalledExactlyOnceWith("classify_subscription_track_activation", {
        p_actor: actorId,
        p_track: trackId,
        p_operation: operationId,
        p_authorization: authorization(),
      });
      expect(from).not.toHaveBeenCalled();
    });
    it("retains the explicit resource owner reservation-required decision", async () => {
      const { gateway, rpc } = activationGateway({ data: { kind: "reservation_required" } });
      await expect(
        classifyTrackActivation(gateway, actorId, trackId, operationId, authorization()),
      ).resolves.toEqual({ kind: "reservation_required" });
      expect(rpc).toHaveBeenCalledTimes(1);
    });
    it.each([
      "actorId",
      "trackId",
      "operationId",
    ] as const)("rejects foreign no-hold %s before accepting an unchanged outcome", async (field) => {
      const { gateway } = activationGateway({ data: { ...unchanged(), [field]: otherId } });
      await expect(
        classifyTrackActivation(gateway, actorId, trackId, operationId, authorization()),
      ).rejects.toThrow();
    });
    it("reads retained unchanged metadata without a reservation or reactivation", async () => {
      const { gateway, rpc, from } = activationGateway({ data: unchanged() });
      await expect(
        readCommittedTrackActivation(gateway, actorId, trackId, operationId),
      ).resolves.toEqual(unchanged());
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
    });
    it("lets the durable owner decide replay after the original deadline", async () => {
      const { gateway, rpc } = activationGateway({ data: receipt() });
      const clock = vi.spyOn(Date, "now").mockReturnValue(authorization().validUntil);
      try {
        await expect(
          activateLearningTrack(gateway, actorId, trackId, operationId, reservation()),
        ).resolves.toEqual(receipt());
        expect(rpc).toHaveBeenCalledTimes(1);
      } finally {
        clock.mockRestore();
      }
    });
    it("reads only the authenticated actors exact durable operation", async () => {
      const recorded = { reservation: reservation(), outcome: receipt() };
      const { gateway, rpc, from } = activationGateway({ data: recorded });
      await expect(
        readCommittedTrackActivation(gateway, actorId, trackId, operationId),
      ).resolves.toEqual({ kind: "reserved", ...recorded });
      expect(rpc).toHaveBeenCalledExactlyOnceWith("read_reserved_subscription_learning_track", {
        p_actor: actorId,
        p_track: trackId,
        p_operation: operationId,
      });
      expect(from).not.toHaveBeenCalled();
    });
    it("returns null for an absent own durable operation", async () => {
      const { gateway, rpc } = activationGateway({ data: null });
      await expect(
        readCommittedTrackActivation(gateway, actorId, trackId, operationId),
      ).resolves.toBeNull();
      expect(rpc).toHaveBeenCalledTimes(1);
    });
    it.each([
      "actorId",
      "trackId",
      "operationId",
    ] as const)("rejects a foreign recorded %s", async (field) => {
      const held = reservation();
      Object.assign(held, { [field]: otherId });
      const { gateway } = activationGateway({
        data: { reservation: held, outcome: { ...receipt(), [field]: otherId } },
      });
      await expect(
        readCommittedTrackActivation(gateway, actorId, trackId, operationId),
      ).rejects.toThrow();
    });
    it.each([
      "actor",
      "subject",
      "expired",
    ] as const)("denies %s authority before database IO", async (kind) => {
      const { gateway, from, rpc } = activationGateway({ data: receipt() });
      const authority = authorization();
      if (kind === "actor") authority.actorId = otherId;
      if (kind === "subject") authority.subject.id = otherId;
      if (kind === "expired") authority.validUntil = 0;
      await expect(
        activateLearningTrack(gateway, actorId, trackId, operationId, reservation(authority)),
      ).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    });

    it.each([
      "operation",
      "track",
      "authority",
    ] as const)("rejects malformed %s before database IO", async (kind) => {
      const { gateway, from, rpc } = activationGateway({ data: receipt() });
      const authority = authorization();
      if (kind === "authority") Object.assign(authority, { mode: "read" });
      await expect(
        activateLearningTrack(
          gateway,
          actorId,
          kind === "track" ? "track-1" : trackId,
          kind === "operation" ? "operation-1" : operationId,
          reservation(authority),
        ),
      ).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
    });

    it.each([
      "actorId",
      "trackId",
      "operationId",
    ] as const)("rejects mismatched %s in the owner acknowledgement", async (field) => {
      const { gateway, from, rpc } = activationGateway({
        data: { ...receipt(), [field]: otherId },
      });
      await expect(
        activateLearningTrack(gateway, actorId, trackId, operationId, reservation()),
      ).rejects.toThrow();
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
    });

    it.each([
      null,
      {},
      { ...receipt(), extra: true },
    ])("rejects malformed acknowledgements without legacy writes", async (data) => {
      const { gateway, from, rpc } = activationGateway({ data });
      await expect(
        activateLearningTrack(gateway, actorId, trackId, operationId, reservation()),
      ).rejects.toThrow();
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
    });

    it("propagates an RPC database error without legacy writes or retries", async () => {
      const { gateway, from, rpc } = activationGateway({ error: { message: "owner unavailable" } });
      await expect(
        activateLearningTrack(gateway, actorId, trackId, operationId, reservation()),
      ).rejects.toThrow("owner unavailable");
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
    });

    it("propagates an RPC transport rejection without legacy writes or retries", async () => {
      const { gateway, from, rpc } = activationGateway({ data: receipt() });
      rpc.mockRejectedValueOnce(new Error("transport unavailable"));
      await expect(
        activateLearningTrack(gateway, actorId, trackId, operationId, reservation()),
      ).rejects.toThrow("transport unavailable");
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
    });
  });

  describe("upsertLearningPath", () => {
    const params = { userId: "u1", trackId: "lt1", roleId: "r1" };

    it("inserts a new learning path", async () => {
      const { gateway, supabase } = gatewayWith({
        learning_paths: { query: { data: { id: "lp1" } } },
      });

      const id = await upsertLearningPath(gateway, params);
      expect(id).toBe("lp1");
      expect(fromChain(supabase)?.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "u1",
          learning_track_id: "lt1",
          role_id: "r1",
        }),
      );
    });

    it("retrieves the existing path on a unique violation", async () => {
      const { gateway } = gatewayWith({
        learning_paths: {
          insert: { error: uniqueViolation },
          update: { data: [{ id: "lp1" }] },
        },
      });

      const id = await upsertLearningPath(gateway, params);
      expect(id).toBe("lp1");
    });

    it("throws when the retrieval fails on a unique violation", async () => {
      const { gateway } = gatewayWith({
        learning_paths: {
          insert: { error: uniqueViolation },
          query: { error: new Error("boom") },
        },
      });

      await expect(upsertLearningPath(gateway, params)).rejects.toThrow(
        "Failed to retrieve or update existing learning path: boom",
      );
    });

    it("throws for other insert errors", async () => {
      const { gateway } = gatewayWith({
        learning_paths: { query: { error: { code: "42P01", message: "relation missing" } } },
      });

      await expect(upsertLearningPath(gateway, params)).rejects.toThrow(
        "Failed to upsert learning path: relation missing",
      );
    });
  });

  describe("syncUserCapabilities", () => {
    it("returns early when the role has no capability sequences", async () => {
      const { gateway, supabase } = gatewayWith({
        role_capability_sequence: { query: { data: [] } },
        user_capabilities: { query: { data: null }, upsert: { data: null } },
      });

      await expect(
        syncUserCapabilities(gateway, { userId: "u1", learningPathId: "lp1", roleId: "r1" }),
      ).resolves.toBeUndefined();
      expect(supabase.from).not.toHaveBeenCalledWith("user_capabilities");
    });

    it("builds upsert rows with gaps and scores", async () => {
      const { gateway, supabase } = gatewayWith({
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

      await syncUserCapabilities(gateway, { userId: "u1", learningPathId: "lp1", roleId: "r1" });

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
      const { gateway, supabase } = gatewayWith({
        role_capability_sequence: { query: { data: [{ id: "s1", required_level: "L5" }] } },
        user_capabilities: { query: { data: null }, upsert: { data: null } },
      });

      await syncUserCapabilities(gateway, { userId: "u1", learningPathId: "lp1", roleId: "r1" });

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
      const { gateway } = gatewayWith({
        role_capability_sequence: { query: { error: new Error("boom") } },
      });
      await expect(
        syncUserCapabilities(gateway, { userId: "u1", learningPathId: "lp1", roleId: "r1" }),
      ).rejects.toThrow("Failed to query role capability sequences: boom");
    });

    it("throws when the existing capabilities query errors", async () => {
      const { gateway } = gatewayWith({
        role_capability_sequence: { query: { data: [{ id: "s1", required_level: "L1" }] } },
        user_capabilities: { query: { error: new Error("boom") } },
      });
      await expect(
        syncUserCapabilities(gateway, { userId: "u1", learningPathId: "lp1", roleId: "r1" }),
      ).rejects.toThrow("Failed to query existing user capabilities: boom");
    });

    it("throws when the upsert errors", async () => {
      const { gateway } = gatewayWith({
        role_capability_sequence: { query: { data: [{ id: "s1", required_level: "L1" }] } },
        user_capabilities: { query: { data: null }, upsert: { error: new Error("boom") } },
      });
      await expect(
        syncUserCapabilities(gateway, { userId: "u1", learningPathId: "lp1", roleId: "r1" }),
      ).rejects.toThrow("Failed to upsert user capabilities: boom");
    });
  });

  describe("ensureShadowRole", () => {
    it("skips upsert when role already exists", async () => {
      const { gateway, supabase } = gatewayWith({
        roles: { query: { data: { id: "r1" } } },
      });
      await ensureShadowRole(gateway, { id: "r1", roleName: "Software Engineer" });
      const rolesChain = fromChain(supabase, 0);
      expect(rolesChain?.upsert).not.toHaveBeenCalled();
    });

    it("upserts role when role does not exist", async () => {
      const { gateway, supabase } = gatewayWith({
        roles: { query: { data: null }, upsert: { data: { id: "r1" } } },
      });
      await ensureShadowRole(gateway, {
        id: "r1",
        roleName: "Software Engineer",
        roleFamilyName: "Engineering",
        domainName: "Tech",
      });
      const rolesChain = fromChain(supabase, 1);
      expect(rolesChain?.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "r1",
          role_name: "Software Engineer",
          role_family_name: "Engineering",
          domain_name: "Tech",
        }),
        expect.anything(),
      );
    });
  });
});
