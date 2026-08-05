import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActiveTrackRole {
  roleId: string;
  roleName: string;
  learningPathId: string;
}

export interface ActiveTrackDetail {
  learningTrackId: string;
  track: string;
  fit: string;
  matchScore: number;
  whyItFits: string;
  roles: ActiveTrackRole[];
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
    throw new Error(`Failed to fetch active learning track: ${trackError.message}`);
  }

  if (!trackData) return null;

  // 2. Fetch all learning paths (roles) under this track
  const { data: pathsData, error: pathsError } = await supabase
    .from("learning_paths")
    .select(`
      id,
      role_id,
      roles (
        role_name
      )
    `)
    .eq("learning_track_id", trackData.id);

  if (pathsError) {
    throw new Error(`Failed to fetch paths for active track: ${pathsError.message}`);
  }

  const roles: ActiveTrackRole[] = (pathsData ?? []).map((p) => {
    const roleData = Array.isArray(p.roles) ? p.roles[0] : p.roles;
    return {
      roleId: p.role_id,
      roleName: roleData?.role_name ?? "",
      learningPathId: p.id,
    };
  });

  return {
    learningTrackId: trackData.id,
    track: trackData.track,
    fit: trackData.fit,
    matchScore: trackData.match_score,
    whyItFits: trackData.why_it_fits ?? "",
    roles,
  };
}

export async function checkRoleExists(supabase: SupabaseClient, roleId: string): Promise<boolean> {
  const { data, error } = await supabase.from("roles").select("id").eq("id", roleId).maybeSingle();

  if (error) {
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
      throw new Error(`Failed to update learning track: ${updateError.message}`);
    }

    return updated.id;
  }

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
    throw new Error(`Failed to activate learning track: ${error.message}`);
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
      throw new Error(
        `Failed to retrieve existing learning path: ${updateError?.message ?? "Not found"}`,
      );
    }

    return updated.id;
  }

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
    throw new Error(`Failed to upsert user capabilities: ${upsertError.message}`);
  }
}
