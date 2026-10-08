import { asQueryGateway, type QueryGatewaySource } from "@functions/lib/query-gateway";
import { z } from "zod";
import { generateCredentialId } from "./credential-id";
import { certificateLogger, errorCode, logCertificateFailure } from "./logging";
import { certificateReplacePolicy } from "./queries";
import type { CertificateRow } from "./types";

const correctionsSchema = z
  .object({
    learner_name: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(500).optional(),
    subtitle: z.string().max(500).nullable().optional(),
    level_label: z.string().max(100).nullable().optional(),
    badge: z.enum(["developing", "skilled", "mastery"]).nullable().optional(),
    completion_date: z.iso.datetime({ offset: true }).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
const replacementSchema = z
  .object({
    certificateId: z.uuid(),
    actorId: z.uuid(),
    reason: z.string().trim().min(1).max(4000),
    corrections: correctionsSchema,
  })
  .strict();
/** Ops-only atomic correction. Retains the old revoked credential and never rewards extra XP. */
export async function replaceCertificate(
  source: QueryGatewaySource,
  input: z.infer<typeof replacementSchema>,
): Promise<CertificateRow> {
  const value = replacementSchema.parse(input);
  const requestId = crypto.randomUUID();
  try {
    const qb = asQueryGateway(source);
    for (let attempt = 0; ; attempt++) {
      try {
        const result = (await qb.rpc(certificateReplacePolicy, {
          args: {
            p_certificate_id: value.certificateId,
            p_actor_id: value.actorId,
            p_reason: value.reason,
            p_credential_id: generateCredentialId(),
            p_corrections: value.corrections,
          },
        })) as CertificateRow;
        certificateLogger.info("certificate.replaced", {
          requestId,
          certificateId: result.id,
          supersedesId: value.certificateId,
        });
        return result;
      } catch (error) {
        if (attempt >= 2 || errorCode(error) !== "23505") throw error;
      }
    }
  } catch (error) {
    logCertificateFailure(error, {
      requestId,
      certificateId: value.certificateId,
      operation: "replace",
    });
    throw error;
  }
}
