import type { QueryGateway } from "@functions/lib/query-gateway";
import {
  completedLevelsPolicy,
  completedPathsPolicy,
  levelSnapshotPolicy,
  modulesSnapshotPolicy,
  readAll,
  roleSnapshotPolicy,
  trackSnapshotPolicy,
} from "./queries";
import type { CertificateRow } from "./types";

export interface CompletedLevel {
  id: string;
  level_id: string;
  learning_path_id: string;
  status: string;
  completed_at: string | null;
  badge: string | null;
}
export interface CompletedPath {
  id: string;
  role_id: string;
  learning_track_id: string;
  status: string;
  completed_at: string | null;
  badge: string | null;
  role_readiness_percentage: number;
}
interface Level {
  title: string;
  level_code: string;
  duration_minutes: number;
  capabilities: { code: string; name: string };
  level_scale: { level_no: number };
}
const badge = (value: string | null): CertificateRow["badge"] =>
  value === "developing" || value === "skilled" || value === "mastery" ? value : null;
export async function courseSnapshot(
  qb: QueryGateway,
  input: { userId: string; levelId: string; levelProgressId: string; learningPathId?: string },
) {
  const progress = await qb.read<CompletedLevel | null>(completedLevelsPolicy, {
    auth: { userId: input.userId },
    filters: [
      { column: "id", op: "eq", value: input.levelProgressId },
      { column: "level_id", op: "eq", value: input.levelId },
    ],
    result: "maybeSingle",
  });
  if (
    progress?.status !== "completed" ||
    !progress.completed_at ||
    (input.learningPathId && progress.learning_path_id !== input.learningPathId)
  )
    throw new Error("Course is not completed");
  const level = await qb.read<Level>(levelSnapshotPolicy, {
    filters: [{ column: "id", op: "eq", value: input.levelId }],
    result: "single",
  });
  const modules = await readAll<{ id: string }>(qb, modulesSnapshotPolicy, {
    filters: [
      { column: "level_id", op: "eq", value: input.levelId },
      { column: "is_active", op: "eq", value: true },
    ],
    sort: [{ column: "id", ascending: true }],
  });
  return {
    certificate_type: "course_completion" as const,
    level_id: input.levelId,
    role_id: null,
    learning_path_id: progress.learning_path_id,
    level_progress_id: progress.id,
    title: level.title,
    subtitle: level.capabilities.name,
    level_label: `Level ${level.level_scale.level_no}`,
    badge: badge(progress.badge),
    completion_date: progress.completed_at,
    metadata: {
      capabilityCode: level.capabilities.code,
      levelCode: level.level_code,
      moduleCount: modules.length,
      durationMinutes: level.duration_minutes,
      learningPathId: progress.learning_path_id,
    },
  };
}
export async function rolePath(qb: QueryGateway, userId: string, learningPathId: string) {
  const path = await qb.read<CompletedPath | null>(completedPathsPolicy, {
    auth: { userId },
    filters: [{ column: "id", op: "eq", value: learningPathId }],
    result: "maybeSingle",
  });
  if (path?.status !== "completed" || !path.completed_at) throw new Error("Role is not completed");
  return path;
}
export async function roleSnapshot(qb: QueryGateway, userId: string, path: CompletedPath) {
  const [role, track, progress] = await Promise.all([
    qb.read<{ role_name: string }>(roleSnapshotPolicy, {
      filters: [{ column: "id", op: "eq", value: path.role_id }],
      result: "single",
    }),
    qb.read<{ track: string }>(trackSnapshotPolicy, {
      auth: { userId },
      filters: [{ column: "id", op: "eq", value: path.learning_track_id }],
      result: "single",
    }),
    readAll<CompletedLevel>(qb, completedLevelsPolicy, {
      auth: { userId },
      filters: [{ column: "learning_path_id", op: "eq", value: path.id }],
      sort: [{ column: "id", ascending: true }],
    }),
  ]);
  const capabilities: Array<{ code: string; name: string; levelLabel: string }> = [];
  for (const item of progress) {
    const level = await qb.read<Level>(levelSnapshotPolicy, {
      filters: [{ column: "id", op: "eq", value: item.level_id }],
      result: "single",
    });
    capabilities.push({ ...level.capabilities, levelLabel: `Level ${level.level_scale.level_no}` });
  }
  return {
    certificate_type: "role_readiness" as const,
    level_id: null,
    role_id: path.role_id,
    learning_path_id: path.id,
    level_progress_id: null,
    title: role.role_name,
    subtitle: track.track,
    level_label: null,
    badge: badge(path.badge),
    completion_date: path.completed_at!,
    metadata: {
      learningTrackId: path.learning_track_id,
      readinessScore: path.role_readiness_percentage,
      capabilities,
    },
  };
}
