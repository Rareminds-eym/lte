import {
  asQueryGateway,
  type QueryGateway,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import { awardXp } from "@functions/lib/xp-engine.core";
import { generateCredentialId } from "./credential-id";
import { resolveLearnerName } from "./learner-name";
import { certificateLogger, errorCode, logCertificateFailure } from "./logging";
import {
  certificateFinalizePolicy,
  certificateInsertPolicy,
  certificateNamePolicy,
  certificateOwnerReadPolicy,
  readAll,
} from "./queries";
import { courseSnapshot, rolePath, roleSnapshot } from "./snapshots";
import type { CertificateEnv, CertificateRow, IssueResult } from "./types";

export async function awardCertificateXp(qb: QueryGateway, row: CertificateRow): Promise<void> {
  if (row.status === "issued" && !row.supersedes_id)
    await awardXp(qb, row.user_id, "certificate_earned", "certificates", row.id, {
      credential_id: row.credential_id,
      certificate_type: row.certificate_type,
    });
}
async function result(
  qb: QueryGateway,
  row: CertificateRow,
  created: boolean,
): Promise<IssueResult> {
  await awardCertificateXp(qb, row);
  return { certificateId: row.id, credentialId: row.credential_id, status: row.status, created };
}
async function nameFor(qb: QueryGateway, userId: string) {
  const user = await qb.read<{ first_name: string | null; last_name: string | null } | null>(
    certificateNamePolicy,
    { auth: { userId }, result: "maybeSingle" },
  );
  return resolveLearnerName(user ?? {});
}
async function issue(
  qb: QueryGateway,
  env: CertificateEnv,
  userId: string,
  subject: "level_id" | "role_id",
  subjectId: string,
  snapshot: () => Promise<Record<string, unknown>>,
): Promise<IssueResult> {
  const requestId = env.requestId ?? crypto.randomUUID();
  const existing = () =>
    qb.read<CertificateRow | null>(certificateOwnerReadPolicy, {
      auth: { userId },
      filters: [{ column: subject, op: "eq", value: subjectId }],
      sort: [
        { column: "status", ascending: true },
        { column: "created_at", ascending: false },
        { column: "id", ascending: false },
      ],
      limit: 1,
      result: "maybeSingle",
    });
  try {
    const previous = await existing();
    if (previous) return await result(qb, previous, false);
    const [display, learnerName] = await Promise.all([snapshot(), nameFor(qb, userId)]);
    for (let attempt = 0; attempt < 3; attempt++) {
      let row: CertificateRow;
      try {
        row = await qb.insert<CertificateRow>(
          certificateInsertPolicy,
          {
            ...display,
            credential_id: generateCredentialId(),
            learner_name: learnerName,
            status: learnerName ? "issued" : "pending_name",
            issued_at: learnerName ? new Date().toISOString() : null,
          },
          { auth: { userId }, result: "single" },
        );
      } catch (error) {
        if (errorCode(error) !== "23505") throw error;
        const winner = await existing();
        if (winner) return await result(qb, winner, false);
        if (attempt === 2) throw error;
        continue;
      }
      certificateLogger.info("certificate.issued", {
        requestId,
        certificateId: row.id,
        type: row.certificate_type,
        status: row.status,
        created: true,
      });
      return await result(qb, row, true);
    }
    throw new Error("Credential collision retries exhausted");
  } catch (error) {
    logCertificateFailure(error, {
      requestId,
      userId,
      type: subject === "level_id" ? "course_completion" : "role_readiness",
      operation: "issue",
    });
    throw error;
  }
}
export async function issueCourseCertificate(
  source: QueryGatewaySource,
  env: CertificateEnv,
  input: { userId: string; levelId: string; levelProgressId: string; learningPathId?: string },
): Promise<IssueResult> {
  const qb = asQueryGateway(source);
  return issue(qb, env, input.userId, "level_id", input.levelId, () => courseSnapshot(qb, input));
}
export async function issueRoleCertificate(
  source: QueryGatewaySource,
  env: CertificateEnv,
  input: { userId: string; learningPathId: string },
): Promise<IssueResult> {
  const qb = asQueryGateway(source);
  const path = await rolePath(qb, input.userId, input.learningPathId);
  return issue(qb, env, input.userId, "role_id", path.role_id, () =>
    roleSnapshot(qb, input.userId, path),
  );
}
export async function finalizePendingNames(
  source: QueryGatewaySource,
  env: CertificateEnv,
  userId: string,
): Promise<number> {
  const qb = asQueryGateway(source);
  const learnerName = await nameFor(qb, userId);
  if (!learnerName) return 0;
  const pending = await readAll<CertificateRow>(qb, certificateOwnerReadPolicy, {
    auth: { userId },
    filters: [{ column: "status", op: "eq", value: "pending_name" }],
    sort: [{ column: "id", ascending: true }],
  });
  let count = 0;
  for (const row of pending) {
    try {
      const updated = await qb.update<CertificateRow[]>(certificateFinalizePolicy, {
        data: { learner_name: learnerName, status: "issued", issued_at: new Date().toISOString() },
        filters: [
          { column: "id", op: "eq", value: row.id },
          { column: "status", op: "eq", value: "pending_name" },
        ],
      });
      for (const issued of updated ?? []) {
        await awardCertificateXp(qb, issued);
        count++;
        certificateLogger.info("certificate.issued", {
          requestId: env.requestId ?? crypto.randomUUID(),
          certificateId: issued.id,
          type: issued.certificate_type,
          status: issued.status,
          created: false,
        });
      }
    } catch (error) {
      logCertificateFailure(error, {
        requestId: env.requestId,
        certificateId: row.id,
        operation: "finalize",
      });
      throw error;
    }
  }
  return count;
}
