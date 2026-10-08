import type { QueryGatewayReadPolicy } from "@functions/lib/query-gateway";

const ownership = { column: "user_id", source: "authenticatedUserId", required: true } as const;
export const certificateColumns = [
  "id",
  "credential_id",
  "supersedes_id",
  "user_id",
  "certificate_type",
  "status",
  "level_id",
  "role_id",
  "learning_path_id",
  "level_progress_id",
  "learner_name",
  "title",
  "subtitle",
  "level_label",
  "badge",
  "completion_date",
  "metadata",
  "issued_at",
  "pdf_object_key",
  "pdf_template_version",
  "pdf_generated_at",
  "revoked_at",
  "revoked_reason",
  "revoked_by",
  "created_at",
  "updated_at",
] as const;
export const certificateOwnerReadPolicy = {
  table: "certificates",
  operation: "read",
  columns: certificateColumns,
  ownership: ownership,
  filters: ["user_id", "id", "credential_id", "certificate_type", "level_id", "role_id", "status"],
  sorts: ["status", "created_at", "id"],
  maxPageSize: 100,
} as const;
export const certificatePublicReadPolicy = {
  table: "certificates",
  operation: "read",
  columns: [
    "credential_id",
    "status",
    "certificate_type",
    "learner_name",
    "title",
    "subtitle",
    "level_label",
    "badge",
    "completion_date",
    "issued_at",
    "revoked_at",
  ],
  filters: ["credential_id"],
} as const;
export const certificateInternalReadPolicy = {
  table: "certificates",
  operation: "read",
  columns: certificateColumns,
  filters: ["user_id", "updated_at", "id", "status", "credential_id"],
  sorts: ["updated_at", "id"],
  maxPageSize: 100,
} as const;
export const certificateInsertPolicy = {
  table: "certificates",
  operation: "insert",
  ownership: ownership,
  insertColumns: [
    "credential_id",
    "certificate_type",
    "status",
    "level_id",
    "role_id",
    "learning_path_id",
    "level_progress_id",
    "learner_name",
    "title",
    "subtitle",
    "level_label",
    "badge",
    "completion_date",
    "metadata",
    "issued_at",
  ],
  returningColumns: certificateColumns,
} as const;
export const certificateFinalizePolicy = {
  table: "certificates",
  operation: "update",
  updateColumns: ["learner_name", "status", "issued_at"],
  requireFilter: true,
  filters: ["user_id", "id", "status"],
  returningColumns: certificateColumns,
} as const;
export const certificatePdfUpdatePolicy = {
  table: "certificates",
  operation: "update",
  updateColumns: ["pdf_object_key", "pdf_template_version", "pdf_generated_at"],
  requireFilter: true,
  filters: ["user_id", "id", "status"],
  returningColumns: ["id"],
} as const;
export const certificateRevokePolicy = {
  table: "certificates",
  operation: "update",
  updateColumns: ["status", "revoked_at", "revoked_reason", "revoked_by"],
  requireFilter: true,
  filters: ["user_id", "id", "status"],
  returningColumns: ["id"],
} as const;
export const certificateNamePolicy = {
  table: "users",
  operation: "read",
  columns: ["first_name", "last_name"],
  filters: ["id"],
  ownership: { column: "id", source: "authenticatedUserId", required: true },
} as const;
export const completedLevelsPolicy = {
  table: "user_capability_level_progress",
  operation: "read",
  ownership: ownership,
  columns: ["id", "level_id", "learning_path_id", "status", "completed_at", "badge"],
  filters: ["user_id", "id", "status", "learning_path_id", "level_id"],
  sorts: ["completed_at", "id"],
  maxPageSize: 100,
} as const;
export const completedPathsPolicy = {
  table: "learning_paths",
  operation: "read",
  ownership: ownership,
  columns: [
    "id",
    "role_id",
    "learning_track_id",
    "status",
    "completed_at",
    "badge",
    "role_readiness_percentage",
  ],
  filters: ["user_id", "id", "status"],
  sorts: ["completed_at", "id"],
  maxPageSize: 100,
} as const;
export const levelSnapshotPolicy = {
  table: "levels",
  operation: "read",
  select: "id,title,level_code,duration_minutes,capabilities(code,name),level_scale(level_no)",
  filters: ["id"],
} as const;
export const roleSnapshotPolicy = {
  table: "roles",
  operation: "read",
  columns: ["role_name"],
  filters: ["id"],
} as const;
export const trackSnapshotPolicy = {
  table: "learning_tracks",
  operation: "read",
  columns: ["track"],
  filters: ["user_id", "id"],
  ownership: ownership,
} as const;
export const modulesSnapshotPolicy = {
  table: "modules",
  operation: "read",
  columns: ["id"],
  filters: ["level_id", "is_active"],
  sorts: ["id"],
  maxPageSize: 100,
} as const;
// Use explicit pagination so Supabase's server row cap cannot silently omit older completions.
export async function readAll<T>(
  qb: import("@functions/lib/query-gateway").QueryGateway,
  policy: QueryGatewayReadPolicy,
  options: import("@functions/lib/query-gateway").QueryGatewayReadOptions,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await qb.read<T[]>(policy, { ...options, page, pageSize: 100 });
    rows.push(...(batch ?? []));
    if (!batch || batch.length < 100) return rows;
  }
}

export const certificateReplacePolicy = {
  operation: "rpc",
  functionName: "replace_certificate",
  allowedArgs: ["p_certificate_id", "p_actor_id", "p_reason", "p_credential_id", "p_corrections"],
} as const;
