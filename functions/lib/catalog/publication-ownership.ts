import type { SupabaseClient } from "@supabase/supabase-js";

/** Active owners are never replaced based on elapsed time alone. */
export function publicationOwnership(
  client: SupabaseClient,
  id: string,
  entityType: "catalog" | "level",
  token: string,
): () => Promise<void> {
  return async () => {
    let query = client
      .from("catalog_versions")
      .select("id")
      .eq("id", id)
      .eq("entity_type", entityType);
    query =
      entityType === "catalog"
        ? query
            .in("status", ["DRAFT", "VALIDATED"])
            .eq("snapshot_data->assetValidation->>status", "PUBLISHING")
            .eq("snapshot_data->assetValidation->>publishingToken", token)
        : query.eq("status", "DRAFT").eq("snapshot_data->>workspacePublishLock", token);
    const { data, error } = await query.maybeSingle();
    if (error || !data)
      throw new Error("Publishing lock was superseded or the version is no longer editable.");
  };
}
