import {
  asQueryGateway,
  QueryGatewayDatabaseError,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import { apiLogger } from "@functions/shared/logger";

export const PATH_STATUS = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  NOT_STARTED: "not_started",
} as const;

export interface ActiveTrackRole {
  roleId: string;
  roleName: string;
  learningPathId: string;
  readinessScore: number;
  status: "in_progress" | "completed" | "not_started";
  updatedAt: string | null;
  domain?: string;
  metadata?: Record<string, unknown>;
}

export interface CareerTrackItem {
  id: string;
  title: string;
  matchPercentage?: number;
  isExplore?: boolean;
  isSelected?: boolean;
  fit?: string;
}

export interface ActiveTrackDetail {
  learningTrackId: string;
  track: string;
  fit: string;
  matchScore: number;
  whyItFits: string;
  roles: ActiveTrackRole[];
  tracks: CareerTrackItem[];
  overallProgress: number;
  completionCount: number;
}

interface ActiveLearningTrackRow {
  id: string;
  track: string;
  fit: string;
  match_score: number;
  why_it_fits: string | null;
}

interface ActiveTrackPathRow {
  id: string;
  role_id: string;
  role_readiness_percentage: number | null;
  status: "in_progress" | "completed" | "not_started" | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
  roles:
    | {
        role_name: string | null;
        domain_name: string | null;
      }
    | Array<{
        role_name: string | null;
        domain_name: string | null;
      }>
    | null;
}

interface UserLearningTrackRow {
  id: string;
  track: string;
  fit: string | null;
  match_score: number | null;
  is_active: boolean | null;
}

const activeLearningTrackReadPolicy = {
  table: "learning_tracks",
  operation: "read",
  columns: ["id", "track", "fit", "match_score", "why_it_fits"],
  filters: ["user_id", "is_active"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const activeTrackPathsReadPolicy = {
  table: "learning_paths",
  operation: "read",
  select: `
    id,
    role_id,
    role_readiness_percentage,
    status,
    updated_at,
    metadata,
    roles (
      role_name,
      domain_name
    )
  `,
  filters: ["user_id", "learning_track_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 100,
} as const;

const userLearningTracksReadPolicy = {
  table: "learning_tracks",
  operation: "read",
  columns: ["id", "track", "fit", "match_score", "is_active"],
  filters: ["user_id"],
  sorts: ["match_score"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 100,
} as const;

const trackPathIdsReadPolicy = {
  table: "learning_paths",
  operation: "read",
  columns: ["id"],
  filters: ["learning_track_id"],
  maxPageSize: 100,
} as const;

const progressUserCapabilitiesReadPolicy = {
  table: "user_capabilities",
  operation: "read",
  columns: ["learning_path_id", "current_level", "required_level", "has_gap"],
  filters: ["user_id", "learning_path_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 500,
} as const;

const roleExistsReadPolicy = {
  table: "roles",
  operation: "read",
  columns: ["id"],
  filters: ["id"],
} as const;

const deactivateLearningTracksPolicy = {
  table: "learning_tracks",
  operation: "update",
  updateColumns: ["is_active"],
  filters: ["user_id", "is_active"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;

const activateLearningTrackPolicy = {
  table: "learning_tracks",
  operation: "update",
  updateColumns: ["is_active"],
  filters: ["user_id", "id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;

const learningPathsForSyncReadPolicy = {
  table: "learning_paths",
  operation: "read",
  columns: ["id", "role_id"],
  filters: ["learning_track_id"],
  maxPageSize: 100,
} as const;

const roleCapabilitySequencesReadPolicy = {
  table: "role_capability_sequence",
  operation: "read",
  columns: ["id", "required_level"],
  filters: ["role_id"],
  maxPageSize: 500,
} as const;

const existingUserCapabilitiesReadPolicy = {
  table: "user_capabilities",
  operation: "read",
  columns: ["role_sequence_id", "current_level"],
  filters: ["user_id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  maxPageSize: 500,
} as const;

const learningTrackInsertPolicy = {
  table: "learning_tracks",
  operation: "insert",
  insertColumns: [
    "user_id",
    "assessment_id",
    "fit",
    "track",
    "match_score",
    "why_it_fits",
    "duration",
    "topics",
    "is_active",
  ],
  returningColumns: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const learningTrackUpdatePolicy = {
  table: "learning_tracks",
  operation: "update",
  updateColumns: ["fit", "match_score", "why_it_fits", "duration", "is_active"],
  filters: ["user_id", "assessment_id", "track"],
  returningColumns: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;

const learningPathInsertPolicy = {
  table: "learning_paths",
  operation: "insert",
  insertColumns: [
    "user_id",
    "learning_track_id",
    "role_id",
    "role_readiness_percentage",
    "level",
    "status",
    "metadata",
  ],
  returningColumns: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

const learningPathUpdatePolicy = {
  table: "learning_paths",
  operation: "update",
  updateColumns: ["metadata"],
  filters: ["user_id", "learning_track_id", "role_id"],
  returningColumns: ["id"],
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
  requireFilter: true,
} as const;

const userCapabilitiesUpsertPolicy = {
  table: "user_capabilities",
  operation: "upsert",
  upsertColumns: [
    "user_id",
    "learning_path_id",
    "role_sequence_id",
    "current_level",
    "required_level",
    "gap",
    "has_gap",
    "gap_score",
    "badge",
    "updated_at",
  ],
  onConflict: "user_id,role_sequence_id",
  ownership: { column: "user_id", source: "authenticatedUserId", required: true },
} as const;

function rethrowQueryError(error: unknown, message: string): never {
  if (error instanceof QueryGatewayDatabaseError) {
    throw new Error(`${message}: ${error.message}`);
  }
  throw error;
}

export async function getActiveLearningTrack(
  source: QueryGatewaySource,
  userId: string,
): Promise<ActiveTrackDetail | null> {
  const qb = asQueryGateway(source);

  // 1. Fetch active track for this user
  let trackData: ActiveLearningTrackRow | null;
  try {
    trackData = (await qb.read(activeLearningTrackReadPolicy, {
      auth: { userId },
      filters: [{ column: "is_active", op: "eq", value: true }],
      result: "maybeSingle",
    })) as ActiveLearningTrackRow | null;
  } catch (error) {
    apiLogger.error("Failed to fetch active learning track", error);
    rethrowQueryError(error, "Failed to fetch active learning track");
  }

  if (!trackData) return null;

  // 2. Fetch all learning paths (roles) under this track
  let pathsData: ActiveTrackPathRow[] | null;
  try {
    pathsData = (await qb.read(activeTrackPathsReadPolicy, {
      auth: { userId },
      filters: [{ column: "learning_track_id", op: "eq", value: trackData.id }],
    })) as ActiveTrackPathRow[] | null;
  } catch (error) {
    apiLogger.error("Failed to fetch paths for active track", error);
    rethrowQueryError(error, "Failed to fetch paths for active track");
  }

  const roles: ActiveTrackRole[] = (pathsData ?? [])
    .map((p) => {
      const roleData = Array.isArray(p.roles) ? p.roles[0] : p.roles;
      return {
        roleId: p.role_id,
        roleName: roleData?.role_name ?? "",
        learningPathId: p.id,
        readinessScore: p.role_readiness_percentage
          ? Math.round(Number(p.role_readiness_percentage))
          : 0,
        status: p.status ?? PATH_STATUS.NOT_STARTED,
        updatedAt: p.updated_at ?? null,
        domain: roleData?.domain_name ?? "",
        metadata: p.metadata ?? {},
      };
    })
    .sort((a, b) => {
      const scoreA =
        a.status === PATH_STATUS.IN_PROGRESS ? 2 : a.status === PATH_STATUS.COMPLETED ? 1 : 0;
      const scoreB =
        b.status === PATH_STATUS.IN_PROGRESS ? 2 : b.status === PATH_STATUS.COMPLETED ? 1 : 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      const parseTime = (dateStr: string | null): number => {
        if (!dateStr) return 0;
        const time = new Date(dateStr).getTime();
        return Number.isNaN(time) || time <= 0 ? 0 : time;
      };
      const timeA = parseTime(a.updatedAt);
      const timeB = parseTime(b.updatedAt);
      return timeB - timeA;
    });

  // 3. Fetch all recommended tracks for the user
  let tracksData: UserLearningTrackRow[] | null;
  try {
    tracksData = (await qb.read(userLearningTracksReadPolicy, {
      auth: { userId },
      sort: [{ column: "match_score", ascending: false }],
    })) as UserLearningTrackRow[] | null;
  } catch (error) {
    apiLogger.error("Failed to fetch all learning tracks for user", error);
    rethrowQueryError(error, "Failed to fetch all learning tracks for user");
  }

  const tracks = (Array.isArray(tracksData) ? tracksData : tracksData ? [tracksData] : []).map(
    (t) => ({
      id: t.id,
      title: t.track,
      matchPercentage: t.match_score ?? undefined,
      isExplore: t.fit === "Explore",
      isSelected: t.is_active ?? undefined,
      fit: t.fit ?? undefined,
    }),
  );

  const stats = await getTrackProgressStats(source, userId, trackData.id);

  return {
    learningTrackId: trackData.id,
    track: trackData.track,
    fit: trackData.fit,
    matchScore: trackData.match_score,
    whyItFits: trackData.why_it_fits ?? "",
    roles,
    tracks,
    overallProgress: stats.overallProgress,
    completionCount: stats.completionCount,
  };
}

export async function getTrackProgressStats(
  source: QueryGatewaySource,
  userId: string,
  trackId: string,
): Promise<{ overallProgress: number; completionCount: number }> {
  const qb = asQueryGateway(source);

  // 1. Fetch all learning paths (roles) under this track
  let paths: Array<{ id: string }> | null;
  try {
    paths = (await qb.read(trackPathIdsReadPolicy, {
      filters: [{ column: "learning_track_id", op: "eq", value: trackId }],
    })) as Array<{ id: string }> | null;
  } catch (error) {
    apiLogger.error("Failed to fetch learning paths for progress calculations", error);
    rethrowQueryError(error, "Failed to fetch learning paths for progress calculations");
  }

  if (!paths || paths.length === 0) {
    return { overallProgress: 0, completionCount: 0 };
  }

  const pathIds = paths.map((p) => p.id);

  // 2. Fetch all user capabilities for these paths
  let userCaps: Array<{
    learning_path_id: string;
    current_level: number | null;
    required_level: number | null;
    has_gap: boolean;
  }> | null;
  try {
    userCaps = (await qb.read(progressUserCapabilitiesReadPolicy, {
      auth: { userId },
      filters: [{ column: "learning_path_id", op: "in", value: pathIds }],
    })) as typeof userCaps;
  } catch (error) {
    apiLogger.error("Failed to fetch user capabilities for progress calculations", error);
    rethrowQueryError(error, "Failed to fetch user capabilities for progress calculations");
  }

  if (!userCaps || userCaps.length === 0) {
    return { overallProgress: 0, completionCount: 0 };
  }

  // 3. Compute overall progress using:
  // overallProgress = SUM(min(current_level, required_level)) / SUM(required_level) * 100
  let totalRequiredLevels = 0;
  let totalCurrentLevelsClamped = 0;

  for (const cap of userCaps) {
    const req = cap.required_level ?? 1;
    const cur = cap.current_level ?? 0;
    totalRequiredLevels += req;
    totalCurrentLevelsClamped += Math.min(cur, req);
  }

  const overallProgress =
    totalRequiredLevels > 0
      ? Math.round((totalCurrentLevelsClamped / totalRequiredLevels) * 100)
      : 0;

  // 4. Compute completion count:
  // Number of learning paths (roles) where all capability gaps are cleared (i.e. no capability has has_gap = true)
  const pathGaps: Record<string, boolean> = {}; // learning_path_id -> has_any_gaps

  for (const pathId of pathIds) {
    pathGaps[pathId] = false;
  }

  for (const cap of userCaps) {
    if (cap.has_gap) {
      pathGaps[cap.learning_path_id] = true;
    }
  }

  let completionCount = 0;
  for (const pathId of pathIds) {
    const capsForPath = userCaps.filter((c) => c.learning_path_id === pathId);
    if (capsForPath.length > 0 && !pathGaps[pathId]) {
      completionCount++;
    }
  }

  return { overallProgress, completionCount };
}

export async function checkRoleExists(
  source: QueryGatewaySource,
  roleId: string,
): Promise<boolean> {
  const qb = asQueryGateway(source);

  let data: unknown;
  try {
    data = await qb.read(roleExistsReadPolicy, {
      filters: [{ column: "id", op: "eq", value: roleId }],
      result: "maybeSingle",
    });
  } catch (error) {
    apiLogger.error("Failed to check role existence", error);
    rethrowQueryError(error, "Failed to check role existence");
  }

  return !!data;
}

const PG_UNIQUE_VIOLATION = "23505";

export async function upsertLearningTrack(
  source: QueryGatewaySource,
  params: {
    userId: string;
    attemptId: string;
    fit: string;
    track: string;
    matchScore: number;
    whyItFits: string;
    duration?: string;
    isActive?: boolean;
  },
): Promise<string> {
  const qb = asQueryGateway(source);
  const isActive = params.isActive ?? false;
  let inserted: { id: string } | null = null;
  let insertError: unknown = null;
  try {
    inserted = (await qb.insert(
      learningTrackInsertPolicy,
      {
        assessment_id: params.attemptId,
        fit: params.fit,
        track: params.track,
        match_score: params.matchScore,
        why_it_fits: params.whyItFits,
        duration: params.duration ?? "6 months",
        topics: [],
        is_active: isActive,
      },
      {
        auth: { userId: params.userId },
        result: "single",
      },
    )) as { id: string };
  } catch (error) {
    insertError = error;
  }

  if (!insertError && inserted) return inserted.id;

  // 23505 = unique_violation — row already exists, update it
  const insertErrorCode =
    insertError instanceof QueryGatewayDatabaseError &&
    insertError.cause &&
    typeof insertError.cause === "object" &&
    "code" in insertError.cause
      ? String(insertError.cause.code)
      : undefined;
  if (insertErrorCode === PG_UNIQUE_VIOLATION) {
    let updated: Array<{ id: string }> | null = null;
    let updateError: unknown = null;
    try {
      updated = (await qb.update(learningTrackUpdatePolicy, {
        auth: { userId: params.userId },
        data: {
          fit: params.fit,
          match_score: params.matchScore,
          why_it_fits: params.whyItFits,
          duration: params.duration ?? "6 months",
          is_active: isActive,
        },
        filters: [
          { column: "assessment_id", op: "eq", value: params.attemptId },
          { column: "track", op: "eq", value: params.track },
        ],
      })) as Array<{ id: string }> | null;
    } catch (error) {
      updateError = error;
    }

    if (updateError || !updated?.[0]) {
      apiLogger.error("Failed to update learning track", updateError);
      throw new Error(
        `Failed to update learning track: ${
          updateError instanceof Error ? updateError.message : "Not found"
        }`,
      );
    }

    return updated[0].id;
  }

  apiLogger.error("Failed to upsert learning track", insertError);
  throw new Error(
    `Failed to upsert learning track: ${
      insertError instanceof Error ? insertError.message : "Unknown error"
    }`,
  );
}

export async function deactivateOtherTracks(
  source: QueryGatewaySource,
  userId: string,
): Promise<void> {
  const qb = asQueryGateway(source);

  try {
    await qb.update(deactivateLearningTracksPolicy, {
      auth: { userId },
      data: { is_active: false },
      filters: [{ column: "is_active", op: "eq", value: true }],
    });
  } catch (error) {
    apiLogger.error("Failed to deactivate other active tracks", error);
    rethrowQueryError(error, "Failed to deactivate other active tracks");
  }
}

export async function activateLearningTrack(
  source: QueryGatewaySource,
  userId: string,
  trackId: string,
): Promise<void> {
  const qb = asQueryGateway(source);
  await deactivateOtherTracks(qb, userId);

  try {
    await qb.update(activateLearningTrackPolicy, {
      auth: { userId },
      data: { is_active: true },
      filters: [{ column: "id", op: "eq", value: trackId }],
    });
  } catch (error) {
    apiLogger.error("Failed to activate learning track", error);
    rethrowQueryError(error, "Failed to activate learning track");
  }

  // Fetch all learning paths for this newly activated track and sync capabilities
  let paths: Array<{ id: string; role_id: string }> | null;
  try {
    paths = (await qb.read(learningPathsForSyncReadPolicy, {
      filters: [{ column: "learning_track_id", op: "eq", value: trackId }],
    })) as Array<{ id: string; role_id: string }> | null;
  } catch (error) {
    apiLogger.error("Failed to fetch learning paths for capability sync", error);
    rethrowQueryError(error, "Failed to fetch learning paths for capability sync");
  }

  if (paths) {
    for (const path of paths) {
      await syncUserCapabilities(qb, {
        userId,
        learningPathId: path.id,
        roleId: path.role_id,
      });
    }
  }
}

export async function upsertLearningPath(
  source: QueryGatewaySource,
  params: {
    userId: string;
    trackId: string;
    roleId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const qb = asQueryGateway(source);
  let inserted: { id: string } | null = null;
  let insertError: unknown = null;
  try {
    inserted = (await qb.insert(
      learningPathInsertPolicy,
      {
        learning_track_id: params.trackId,
        role_id: params.roleId,
        role_readiness_percentage: 0.0,
        level: 1,
        status: "not_started",
        metadata: params.metadata ?? {},
      },
      {
        auth: { userId: params.userId },
        result: "single",
      },
    )) as { id: string };
  } catch (error) {
    insertError = error;
  }

  if (!insertError && inserted) return inserted.id;

  // 23505 = unique_violation — row already exists, just update its metadata and retrieve the ID
  const insertErrorCode =
    insertError instanceof QueryGatewayDatabaseError &&
    insertError.cause &&
    typeof insertError.cause === "object" &&
    "code" in insertError.cause
      ? String(insertError.cause.code)
      : undefined;
  if (insertErrorCode === PG_UNIQUE_VIOLATION) {
    let updated: Array<{ id: string }> | null = null;
    let updateError: unknown = null;
    try {
      updated = (await qb.update(learningPathUpdatePolicy, {
        auth: { userId: params.userId },
        data: {
          metadata: params.metadata ?? {},
        },
        filters: [
          { column: "learning_track_id", op: "eq", value: params.trackId },
          { column: "role_id", op: "eq", value: params.roleId },
        ],
      })) as Array<{ id: string }> | null;
    } catch (error) {
      updateError = error;
    }

    if (updateError || !updated?.[0]) {
      apiLogger.error("Failed to retrieve or update existing learning path", updateError);
      throw new Error(
        `Failed to retrieve or update existing learning path: ${
          updateError instanceof Error ? updateError.message : "Not found"
        }`,
      );
    }

    return updated[0].id;
  }

  apiLogger.error("Failed to upsert learning path", insertError);
  throw new Error(
    `Failed to upsert learning path: ${
      insertError instanceof Error ? insertError.message : "Unknown error"
    }`,
  );
}

export async function syncUserCapabilities(
  source: QueryGatewaySource,
  params: {
    userId: string;
    learningPathId: string;
    roleId: string;
  },
): Promise<void> {
  const qb = asQueryGateway(source);

  // 1. Fetch capability sequence details for the role
  let sequences: Array<{ id: string; required_level: string | null }> | null;
  try {
    sequences = (await qb.read(roleCapabilitySequencesReadPolicy, {
      filters: [{ column: "role_id", op: "eq", value: params.roleId }],
    })) as Array<{ id: string; required_level: string | null }> | null;
  } catch (error) {
    apiLogger.error("Failed to query role capability sequences", error);
    rethrowQueryError(error, "Failed to query role capability sequences");
  }

  if (!sequences || sequences.length === 0) {
    return; // No capabilities defined for this role sequence
  }

  // 2. Fetch existing user capabilities to preserve current progress levels
  let existingCaps: Array<{ role_sequence_id: string; current_level: number }> | null;
  try {
    existingCaps = (await qb.read(existingUserCapabilitiesReadPolicy, {
      auth: { userId: params.userId },
    })) as Array<{ role_sequence_id: string; current_level: number }> | null;
  } catch (error) {
    apiLogger.error("Failed to query existing user capabilities", error);
    rethrowQueryError(error, "Failed to query existing user capabilities");
  }

  const existingMap = new Map<string, number>(
    existingCaps?.map((c) => [c.role_sequence_id, c.current_level]) ?? [],
  );

  const levelMap: Record<string, number> = {
    L1: 1,
    L2: 2,
    L3: 3,
    L4: 4,
    L5: 5,
  };

  // 3. Build upsert rows
  const rows = sequences.map((seq) => {
    const requiredLevelNum = levelMap[seq.required_level as string] || 1;
    const currentLevelNum = existingMap.get(seq.id) || 0;
    const gap = Math.max(0, requiredLevelNum - currentLevelNum);
    const gapScore =
      requiredLevelNum > 0 ? Math.round((currentLevelNum / requiredLevelNum) * 100) : 0;

    return {
      learning_path_id: params.learningPathId,
      role_sequence_id: seq.id,
      current_level: currentLevelNum,
      required_level: requiredLevelNum,
      gap,
      has_gap: gap > 0,
      gap_score: gapScore,
      badge: "none",
      updated_at: new Date().toISOString(),
    };
  });

  try {
    await qb.upsert(userCapabilitiesUpsertPolicy, rows, {
      auth: { userId: params.userId },
    });
  } catch (upsertError) {
    apiLogger.error("Failed to upsert user capabilities", upsertError);
    throw new Error(
      `Failed to upsert user capabilities: ${
        upsertError instanceof Error ? upsertError.message : "Unknown error"
      }`,
    );
  }
}
