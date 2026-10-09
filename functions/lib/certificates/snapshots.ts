import type { QueryGateway } from "@functions/lib/query-gateway";
import { z } from "zod";
import {
  completedLevelsPolicy,
  completedPathsPolicy,
  levelSnapshotPolicy,
  modulesSnapshotPolicy,
  readAll,
  roleSnapshotPolicy,
  trackSnapshotPolicy,
} from "./queries";
import { completedLevelSchema, completedPathSchema, levelSchema } from "./snapshotSchemas";
import type { CertificateRow } from "./types";
import { parseCertificateData } from "./types";

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
const badge = (value: string | null): CertificateRow["badge"] =>
  value === "developing" || value === "skilled" || value === "mastery" ? value : null;
export async function courseSnapshot(
  qb: QueryGateway,
  input: { userId: string; levelId: string; levelProgressId: string; learningPathId?: string },
) {
  const progress = parseCertificateData(
    completedLevelSchema.nullable(),
    await qb.read(completedLevelsPolicy, {
      auth: { userId: input.userId },
      filters: [
        { column: "id", op: "eq", value: input.levelProgressId },
        { column: "level_id", op: "eq", value: input.levelId },
      ],
      result: "maybeSingle",
    }),
  );
  if (
    progress?.status !== "completed" ||
    !progress.completed_at ||
    (input.learningPathId && progress.learning_path_id !== input.learningPathId)
  )
    throw new Error("Course is not completed");
  const level = parseCertificateData(
    levelSchema.nullable(),
    await qb.read(levelSnapshotPolicy, {
      filters: [{ column: "id", op: "eq", value: input.levelId }],
      result: "single",
    }),
  );
  if (!level) throw new Error("Certificate level snapshot not found");
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
  const path = parseCertificateData(
    completedPathSchema.nullable(),
    await qb.read(completedPathsPolicy, {
      auth: { userId },
      filters: [{ column: "id", op: "eq", value: learningPathId }],
      result: "maybeSingle",
    }),
  );
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
  if (!role || !track) throw new Error("Certificate role snapshot not found");
  const roleName = parseCertificateData(z.object({ role_name: z.string() }), role).role_name;
  const trackName = parseCertificateData(z.object({ track: z.string() }), track).track;
  parseCertificateData(z.array(completedLevelSchema), progress);
  const capabilities: Array<{ code: string; name: string; levelLabel: string }> = [];
  for (const item of progress) {
    const level = parseCertificateData(
      levelSchema.nullable(),
      await qb.read(levelSnapshotPolicy, {
        filters: [{ column: "id", op: "eq", value: item.level_id }],
        result: "single",
      }),
    );
    if (!level) throw new Error("Certificate capability snapshot not found");
    capabilities.push({ ...level.capabilities, levelLabel: `Level ${level.level_scale.level_no}` });
  }
  return {
    certificate_type: "role_readiness" as const,
    level_id: null,
    role_id: path.role_id,
    learning_path_id: path.id,
    level_progress_id: null,
    title: roleName,
    subtitle: trackName,
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
