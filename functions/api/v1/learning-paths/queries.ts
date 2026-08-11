import { apiLogger } from "@functions/shared/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  status: string;
  updatedAt: string | null;
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

export async function getActiveLearningTrack(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveTrackDetail | null> {
  // 1. Fetch active track for this user
  const { data: trackData, error: trackError } = await supabase
    .from("learning_tracks")
    .select("id, track, fit, match_score, why_it_fits")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (trackError) {
    apiLogger.error("Failed to fetch active learning track", trackError);
    throw new Error(`Failed to fetch active learning track: ${trackError.message}`);
  }

  if (!trackData) return null;

  // 2. Fetch all learning paths (roles) under this track
  const { data: pathsData, error: pathsError } = await supabase
    .from("learning_paths")
    .select(`
      id,
      role_id,
      role_readiness_percentage,
      status,
      updated_at,
      roles (
        role_name
      )
    `)
    .eq("learning_track_id", trackData.id);

  if (pathsError) {
    apiLogger.error("Failed to fetch paths for active track", pathsError);
    throw new Error(`Failed to fetch paths for active track: ${pathsError.message}`);
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
      };
    })
    .sort((a, b) => {
      const scoreA =
        a.status === PATH_STATUS.IN_PROGRESS ? 2 : a.status === PATH_STATUS.COMPLETED ? 1 : 0;
      const scoreB =
        b.status === PATH_STATUS.IN_PROGRESS ? 2 : b.status === PATH_STATUS.COMPLETED ? 1 : 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

  // 3. Fetch all recommended tracks for the user
  const { data: tracksData, error: tracksError } = await supabase
    .from("learning_tracks")
    .select("id, track, fit, match_score, is_active")
    .eq("user_id", userId)
    .order("match_score", { ascending: false });

  if (tracksError) {
    apiLogger.error("Failed to fetch all learning tracks for user", tracksError);
    throw new Error(`Failed to fetch all learning tracks for user: ${tracksError.message}`);
  }

  const tracks = (Array.isArray(tracksData) ? tracksData : tracksData ? [tracksData] : []).map(
    (t) => ({
      id: t.id,
      title: t.track,
      matchPercentage: t.match_score,
      isExplore: t.fit === "Explore",
      isSelected: t.is_active,
      fit: t.fit,
    }),
  );

  const stats = await getTrackProgressStats(supabase, userId, trackData.id);

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
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
): Promise<{ overallProgress: number; completionCount: number }> {
  // 1. Fetch all learning paths (roles) under this track
  const { data: paths, error: pathsError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("learning_track_id", trackId);

  if (pathsError) {
    apiLogger.error("Failed to fetch learning paths for progress calculations", pathsError);
    throw new Error(
      `Failed to fetch learning paths for progress calculations: ${pathsError.message}`,
    );
  }

  if (!paths || paths.length === 0) {
    return { overallProgress: 0, completionCount: 0 };
  }

  const pathIds = paths.map((p) => p.id);

  // 2. Fetch all user capabilities for these paths
  const { data: userCaps, error: capsError } = await supabase
    .from("user_capabilities")
    .select("learning_path_id, current_level, required_level, has_gap")
    .eq("user_id", userId)
    .in("learning_path_id", pathIds);

  if (capsError) {
    apiLogger.error("Failed to fetch user capabilities for progress calculations", capsError);
    throw new Error(
      `Failed to fetch user capabilities for progress calculations: ${capsError.message}`,
    );
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

export async function checkRoleExists(supabase: SupabaseClient, roleId: string): Promise<boolean> {
  const { data, error } = await supabase.from("roles").select("id").eq("id", roleId).maybeSingle();

  if (error) {
    apiLogger.error("Failed to check role existence", error);
    throw new Error(`Failed to check role existence: ${error.message}`);
  }

  return !!data;
}

const PG_UNIQUE_VIOLATION = "23505";

export async function upsertLearningTrack(
  supabase: SupabaseClient,
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
  const isActive = params.isActive ?? false;
  const { data: inserted, error: insertError } = await supabase
    .from("learning_tracks")
    .insert({
      user_id: params.userId,
      assessment_id: params.attemptId,
      fit: params.fit,
      track: params.track,
      match_score: params.matchScore,
      why_it_fits: params.whyItFits,
      duration: params.duration ?? "6 months",
      topics: [],
      is_active: isActive,
    })
    .select("id")
    .single();

  if (!insertError) return inserted.id;

  // 23505 = unique_violation — row already exists, update it
  if (insertError.code === PG_UNIQUE_VIOLATION) {
    const { data: updated, error: updateError } = await supabase
      .from("learning_tracks")
      .update({
        fit: params.fit,
        match_score: params.matchScore,
        why_it_fits: params.whyItFits,
        duration: params.duration ?? "6 months",
        is_active: isActive,
      })
      .eq("user_id", params.userId)
      .eq("assessment_id", params.attemptId)
      .eq("track", params.track)
      .select("id")
      .single();

    if (updateError) {
      apiLogger.error("Failed to update learning track", updateError);
      throw new Error(`Failed to update learning track: ${updateError.message}`);
    }

    return updated.id;
  }

  apiLogger.error("Failed to upsert learning track", insertError);
  throw new Error(`Failed to upsert learning track: ${insertError.message}`);
}

export async function deactivateOtherTracks(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("learning_tracks")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    apiLogger.error("Failed to deactivate other active tracks", error);
    throw new Error(`Failed to deactivate other active tracks: ${error.message}`);
  }
}

export async function activateLearningTrack(
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
): Promise<void> {
  await deactivateOtherTracks(supabase, userId);

  const { error } = await supabase
    .from("learning_tracks")
    .update({ is_active: true })
    .eq("user_id", userId)
    .eq("id", trackId);

  if (error) {
    apiLogger.error("Failed to activate learning track", error);
    throw new Error(`Failed to activate learning track: ${error.message}`);
  }

  // Fetch all learning paths for this newly activated track and sync capabilities
  const { data: paths, error: pathsError } = await supabase
    .from("learning_paths")
    .select("id, role_id")
    .eq("learning_track_id", trackId);

  if (pathsError) {
    apiLogger.error("Failed to fetch learning paths for capability sync", pathsError);
    throw new Error(`Failed to fetch learning paths for capability sync: ${pathsError.message}`);
  }

  if (paths) {
    for (const path of paths) {
      await syncUserCapabilities(supabase, {
        userId,
        learningPathId: path.id,
        roleId: path.role_id,
      });
    }
  }
}

export async function upsertLearningPath(
  supabase: SupabaseClient,
  params: {
    userId: string;
    trackId: string;
    roleId: string;
  },
): Promise<string> {
  const { data: inserted, error: insertError } = await supabase
    .from("learning_paths")
    .insert({
      user_id: params.userId,
      learning_track_id: params.trackId,
      role_id: params.roleId,
      role_readiness_percentage: 0.0,
      level: 1,
      status: "not_started",
    })
    .select("id")
    .single();

  if (!insertError) return inserted.id;

  // 23505 = unique_violation — row already exists, just retrieve the existing ID
  if (insertError.code === PG_UNIQUE_VIOLATION) {
    const { data: updated, error: updateError } = await supabase
      .from("learning_paths")
      .select("id")
      .eq("user_id", params.userId)
      .eq("learning_track_id", params.trackId)
      .eq("role_id", params.roleId)
      .maybeSingle();

    if (updateError || !updated) {
      apiLogger.error("Failed to retrieve existing learning path", updateError);
      throw new Error(
        `Failed to retrieve existing learning path: ${updateError?.message ?? "Not found"}`,
      );
    }

    return updated.id;
  }

  apiLogger.error("Failed to upsert learning path", insertError);
  throw new Error(`Failed to upsert learning path: ${insertError.message}`);
}

export async function syncUserCapabilities(
  supabase: SupabaseClient,
  params: {
    userId: string;
    learningPathId: string;
    roleId: string;
  },
): Promise<void> {
  // 1. Fetch capability sequence details for the role
  const { data: sequences, error: seqError } = await supabase
    .from("role_capability_sequence")
    .select("id, required_level")
    .eq("role_id", params.roleId);

  if (seqError) {
    apiLogger.error("Failed to query role capability sequences", seqError);
    throw new Error(`Failed to query role capability sequences: ${seqError.message}`);
  }

  if (!sequences || sequences.length === 0) {
    return; // No capabilities defined for this role sequence
  }

  // 2. Fetch existing user capabilities to preserve current progress levels
  const { data: existingCaps, error: capError } = await supabase
    .from("user_capabilities")
    .select("role_sequence_id, current_level")
    .eq("user_id", params.userId);

  if (capError) {
    apiLogger.error("Failed to query existing user capabilities", capError);
    throw new Error(`Failed to query existing user capabilities: ${capError.message}`);
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
      user_id: params.userId,
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

  // 4. Perform bulk upsert
  const { error: upsertError } = await supabase
    .from("user_capabilities")
    .upsert(rows, { onConflict: "user_id,role_sequence_id" });

  if (upsertError) {
    apiLogger.error("Failed to upsert user capabilities", upsertError);
    throw new Error(`Failed to upsert user capabilities: ${upsertError.message}`);
  }
}
