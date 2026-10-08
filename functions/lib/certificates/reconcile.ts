import { asQueryGateway, type QueryGatewaySource } from "@functions/lib/query-gateway";
import {
  awardCertificateXp,
  finalizePendingNames,
  issueCourseCertificate,
  issueRoleCertificate,
} from "./issuance";
import { logCertificateFailure } from "./logging";
import {
  certificateOwnerReadPolicy,
  completedLevelsPolicy,
  completedPathsPolicy,
  readAll,
} from "./queries";
import type { CompletedLevel, CompletedPath } from "./snapshots";
import type { CertificateEnv, CertificateRow } from "./types";

export async function ensureCertificatesForUser(
  source: QueryGatewaySource,
  env: CertificateEnv,
  userId: string,
): Promise<void> {
  const qb = asQueryGateway(source);
  const options = {
    auth: { userId },
    filters: [{ column: "status", op: "eq" as const, value: "completed" }],
    sort: [
      { column: "completed_at", ascending: true },
      { column: "id", ascending: true },
    ],
  };
  const [levels, paths, existing] = await Promise.all([
    readAll<CompletedLevel>(qb, completedLevelsPolicy, options),
    readAll<CompletedPath>(qb, completedPathsPolicy, options),
    readAll<CertificateRow>(qb, certificateOwnerReadPolicy, {
      auth: { userId },
      sort: [{ column: "id", ascending: true }],
    }),
  ]);
  const levelIds = new Set(existing.map((row) => row.level_id));
  const roleIds = new Set(existing.map((row) => row.role_id));
  const tasks: Array<() => Promise<unknown>> = [];
  for (const row of levels)
    if (!levelIds.has(row.level_id)) {
      levelIds.add(row.level_id);
      tasks.push(() =>
        issueCourseCertificate(qb, env, {
          userId,
          levelId: row.level_id,
          levelProgressId: row.id,
          learningPathId: row.learning_path_id,
        }),
      );
    }
  for (const row of paths)
    if (!roleIds.has(row.role_id)) {
      roleIds.add(row.role_id);
      tasks.push(() => issueRoleCertificate(qb, env, { userId, learningPathId: row.id }));
    }
  for (const task of tasks.slice(0, 5)) {
    try {
      await task();
    } catch (error) {
      logCertificateFailure(error, { requestId: env.requestId, userId, operation: "reconcile" });
    }
  }
  await finalizePendingNames(qb, env, userId);
  // Heal a crash after insert/finalization but before the idempotent XP write.
  for (const row of existing) await awardCertificateXp(qb, row);
}
