import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkRoleExists(supabase: SupabaseClient, roleId: string): Promise<boolean> {
  const { data, error } = await supabase.from("roles").select("id").eq("id", roleId).maybeSingle();

  if (error) {
    throw new Error(`Failed to check role existence: ${error.message}`);
  }

  return !!data;
}

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
  // Query first because there is no unique constraint/index on (user_id, assessment_id, track)
  const { data: existingTrack, error: findError } = await supabase
    .from("learning_tracks")
    .select("id")
    .eq("user_id", params.userId)
    .eq("assessment_id", params.attemptId)
    .eq("track", params.track)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to query existing learning track: ${findError.message}`);
  }

  if (existingTrack) {
    const { data: updated, error: updateError } = await supabase
      .from("learning_tracks")
      .update({
        fit: params.fit,
        match_score: params.matchScore,
        why_it_fits: params.whyItFits,
      })
      .eq("id", existingTrack.id)
      .select("id")
      .single();

    if (updateError) {
      throw new Error(`Failed to update learning track: ${updateError.message}`);
    }

    return updated.id;
  } else {
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

    if (insertError) {
      throw new Error(`Failed to insert learning track: ${insertError.message}`);
    }

    return inserted.id;
  }
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
  },
): Promise<string> {
  // Mirror upsertLearningTrack: check first, do nothing if the exact
  // (user, track, role) row already exists, otherwise insert a new one.
  const { data: existingPath, error: findError } = await supabase
    .from("learning_paths")
    .select("id")
    .eq("user_id", params.userId)
    .eq("learning_track_id", params.trackId)
    .eq("role_id", params.roleId)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to query existing learning path: ${findError.message}`);
  }

  // Row already exists for this exact (user, track, role) — reactivate it and return its id
  if (existingPath) {
    const { data: updated, error: updateError } = await supabase
      .from("learning_paths")
      .update({ is_active: true })
      .eq("id", existingPath.id)
      .select("id")
      .single();

    if (updateError) {
      throw new Error(`Failed to reactivate learning path: ${updateError.message}`);
    }

    return updated.id;
  }

  // No matching row — insert a fresh learning path
  const { data: inserted, error: insertError } = await supabase
    .from("learning_paths")
    .insert({
      user_id: params.userId,
      learning_track_id: params.trackId,
      role_id: params.roleId,
      role_readiness_percentage: 0.0,
      level: 1,
      status: "not_started",
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to insert learning path: ${insertError.message}`);
  }

  return inserted.id;
}
