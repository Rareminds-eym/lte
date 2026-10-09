import {
  asQueryGateway,
  type QueryGateway,
  type QueryGatewaySource,
} from "@functions/lib/query-gateway";
import { XP_AMOUNTS } from "@functions/lib/xp-engine.core";
import { generateCredentialId } from "./credentialId";
import { resolveLearnerName } from "./learnerName";
import { certificateLogger, errorCode, logCertificateFailure } from "./logging";
import {
  certificateFinalizeAtomicPolicy,
  certificateIssuePolicy,
  certificateNamePolicy,
  certificateOwnerReadPolicy,
  readAll,
} from "./queries";
import { courseSnapshot, rolePath, roleSnapshot } from "./snapshots";
import {
  atomicIssueResultSchema,
  type CertificateEnv,
  type CertificateRow,
  certificateRowSchema,
  type IssueResult,
  parseCertificateData,
} from "./types";

const certificateXpAmount = XP_AMOUNTS["certificate_earned"] ?? 0;

function result(row: CertificateRow, created: boolean): IssueResult {
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
    if (previous) return result(parseCertificateData(certificateRowSchema, previous), false);
    const [display, learnerName] = await Promise.all([snapshot(), nameFor(qb, userId)]);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const issuedAt = learnerName ? new Date().toISOString() : null;
        const rpcResult = parseCertificateData(
          atomicIssueResultSchema,
          await qb.rpc(certificateIssuePolicy, {
            auth: { userId },
            args: {
              p_credential_id: generateCredentialId(),
              p_certificate_type: display["certificate_type"],
              p_status: learnerName ? "issued" : "pending_name",
              p_level_id: display["level_id"] ?? null,
              p_role_id: display["role_id"] ?? null,
              p_learning_path_id: display["learning_path_id"] ?? null,
              p_level_progress_id: display["level_progress_id"] ?? null,
              p_learner_name: learnerName,
              p_title: display["title"],
              p_subtitle: display["subtitle"] ?? null,
              p_level_label: display["level_label"] ?? null,
              p_badge: display["badge"] ?? null,
              p_completion_date: display["completion_date"],
              p_metadata: display["metadata"] ?? {},
              p_issued_at: issuedAt,
              p_xp_amount: certificateXpAmount,
            },
          }),
        );
        const row = rpcResult.certificate;
        if (rpcResult.created) {
          certificateLogger.info("certificate.issued", {
            requestId,
            certificateId: row.id,
            type: row.certificate_type,
            status: row.status,
            created: true,
          });
        }
        return result(row, rpcResult.created);
      } catch (error) {
        if (errorCode(error) !== "23505" || attempt === 2) throw error;
        const winner = await existing();
        if (winner) return result(parseCertificateData(certificateRowSchema, winner), false);
      }
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
      const raw = await qb.rpc(certificateFinalizeAtomicPolicy, {
        auth: { userId },
        args: {
          p_certificate_id: row.id,
          p_learner_name: learnerName,
          p_issued_at: new Date().toISOString(),
          p_xp_amount: certificateXpAmount,
        },
      });
      const parsed = parseCertificateData(certificateRowSchema.nullable(), raw);
      if (parsed) {
        count++;
        certificateLogger.info("certificate.issued", {
          requestId: env.requestId ?? crypto.randomUUID(),
          certificateId: parsed.id,
          type: parsed.certificate_type,
          status: parsed.status,
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
