import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActiveLearningPath {
  learningPathId: string;
  learningTrackId: string;
  roleId: string;
  track: string;
  fit: string;
  matchScore: number;
}

export async function getActiveLearningPath(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveLearningPath | null> {
  const { data, error } = await supabase
    .from("learning_paths")
    .select(`
      id,
      learning_track_id,
      role_id,
      learning_tracks (
        track,
        fit,
        match_score
      )
    `)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active learning path: ${error.message}`);
  }

  if (!data) return null;

  const trackData = Array.isArray(data.learning_tracks)
    ? data.learning_tracks[0]
    : data.learning_tracks;

  return {
    learningPathId: data.id,
    learningTrackId: data.learning_track_id,
    roleId: data.role_id,
    track: trackData?.track ?? "",
    fit: trackData?.fit ?? "",
    matchScore: trackData?.match_score ?? 0,
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
  },
): Promise<string> {
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

export async function deactivateOtherPaths(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("learning_paths")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to deactivate other active paths: ${error.message}`);
  }
}

export async function upsertLearningPath(
  supabase: SupabaseClient,
  params: {
    userId: string;
    trackId: string;
    roleId: string;
    isActive?: boolean;
  },
): Promise<string> {
  const isActive = params.isActive ?? true;
  const { data: inserted, error: insertError } = await supabase
    .from("learning_paths")
    .insert({
      user_id: params.userId,
      learning_track_id: params.trackId,
      role_id: params.roleId,
      role_readiness_percentage: 0.0,
      level: 1,
      status: "not_started",
      is_active: isActive,
    })
    .select("id")
    .single();

  if (!insertError) return inserted.id;

  // 23505 = unique_violation — row already exists, update active status
  if (insertError.code === PG_UNIQUE_VIOLATION) {
    const { data: updated, error: updateError } = await supabase
      .from("learning_paths")
      .update({ is_active: isActive })
      .eq("user_id", params.userId)
      .eq("learning_track_id", params.trackId)
      .eq("role_id", params.roleId)
      .select("id")
      .single();

    if (updateError) {
      throw new Error(`Failed to reactivate learning path: ${updateError.message}`);
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
