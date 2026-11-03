import { asQueryGateway, type QueryGatewaySource } from "@functions/lib/query-gateway";
import { z } from "zod";
import { logCertificateFailure } from "./logging";
import { certificateRevokePolicy } from "./queries";

const inputSchema = z.object({
  certificateId: z.uuid(),
  reason: z.string().trim().min(1).max(4000),
  actorId: z.uuid(),
});
/** Ops-only; no HTTP route. Pending certificates must be finalized before revocation. */
export async function revokeCertificate(
  source: QueryGatewaySource,
  input: z.infer<typeof inputSchema>,
): Promise<void> {
  const { certificateId, reason, actorId } = inputSchema.parse(input);
  try {
    await asQueryGateway(source).update(certificateRevokePolicy, {
      data: {
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_reason: reason,
        revoked_by: actorId,
      },
      filters: [
        { column: "id", op: "eq", value: certificateId },
        { column: "status", op: "eq", value: "issued" },
      ],
    });
  } catch (error) {
    logCertificateFailure(error, { certificateId, operation: "revoke" });
    throw error;
  }
}
