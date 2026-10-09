import { asQueryGateway, type QueryGatewaySource } from "@functions/lib/query-gateway";
import type { LteEnv } from "@functions/lib/types";
import { z } from "zod";
import { CERTIFICATE_CONFIG } from "./config";
import { logCertificateFailure } from "./logging";
import { certificateInternalReadPolicy } from "./queries";
import { parseCertificateData } from "./types";

const jobSchema = z
  .object({
    id: z.uuid(),
    user_id: z.uuid(),
    certificate_id: z.uuid().nullable(),
    object_key: z.string().nullable(),
    prefix: z.string().nullable(),
    lease_token: z.uuid(),
  })
  .refine((job) => (job.object_key === null) !== (job.prefix === null))
  .refine((job) =>
    (job.object_key ?? job.prefix)?.startsWith(`certificates/users/${job.user_id}/`),
  );

const registerPolicy = {
  operation: "rpc",
  functionName: "register_certificate_pdf_upload",
  allowedArgs: ["p_certificate_id", "p_object_key"],
} as const;
const claimPolicy = {
  operation: "rpc",
  functionName: "claim_certificate_storage_cleanup",
  allowedArgs: ["p_lease_token", "p_limit"],
} as const;
const finishPolicy = {
  operation: "rpc",
  functionName: "finish_certificate_storage_cleanup",
  allowedArgs: ["p_id", "p_lease_token", "p_success"],
} as const;

export async function registerCertificateUpload(
  source: QueryGatewaySource,
  certificateId: string,
  key: string,
) {
  await asQueryGateway(source).rpc(registerPolicy, {
    args: { p_certificate_id: certificateId, p_object_key: key },
  });
}

/** Bounded, leased work: failed deletions remain durable and retry after backoff.
 * Run via Pages waitUntil; the maintenance endpoint also permits scheduled drains. */
export async function drainCertificateStorageCleanup(
  source: QueryGatewaySource,
  env: LteEnv,
  requestId: string,
) {
  const qb = asQueryGateway(source);
  const leaseToken = crypto.randomUUID();
  const jobs = parseCertificateData(
    z.array(jobSchema),
    await qb.rpc(claimPolicy, {
      args: { p_lease_token: leaseToken, p_limit: CERTIFICATE_CONFIG.cleanupBatchSize },
    }),
  );
  for (const job of jobs) {
    let success = false;
    try {
      if (job.lease_token !== leaseToken) throw new Error("Unexpected cleanup lease");
      if (job.object_key) {
        const referenced = await qb.read<Array<{ id: string }>>(
          {
            ...certificateInternalReadPolicy,
            columns: ["id"],
            filters: ["pdf_object_key"],
          },
          { filters: [{ column: "pdf_object_key", op: "eq", value: job.object_key }] },
        );
        if (!referenced?.length) await env.STORAGE_BUCKET.delete(job.object_key);
        success = true;
      } else if (job.prefix) {
        const referenced = await qb.read<Array<{ id: string }>>(certificateInternalReadPolicy, {
          filters: [
            {
              column: job.certificate_id ? "id" : "user_id",
              op: "eq",
              value: job.certificate_id ?? job.user_id,
            },
          ],
          pageSize: 1,
        });
        if (!referenced?.length) {
          const list = env.STORAGE_BUCKET.list;
          if (!list) throw new Error("Certificate cleanup requires R2 list");
          // Delete the first page then reschedule if needed; no cursor can skip
          // objects when the bucket changes between batches.
          const page = await list.call(env.STORAGE_BUCKET, {
            prefix: job.prefix,
            limit: CERTIFICATE_CONFIG.cleanupPageSize,
          });
          const keys = page.objects.map((object) => object.key);
          if (keys.some((key) => !key.startsWith(job.prefix!)))
            throw new Error("Unexpected R2 object prefix");
          if (keys.length) await env.STORAGE_BUCKET.delete(keys);
          success = !page.truncated;
        }
      }
    } catch (error) {
      logCertificateFailure(error, {
        requestId,
        operation: "storage_cleanup",
        cleanupJobId: job.id,
      });
    }
    await qb.rpc(finishPolicy, {
      args: { p_id: job.id, p_lease_token: leaseToken, p_success: success },
    });
  }
  return jobs.length;
}
