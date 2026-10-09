import { asQueryGateway, type QueryGatewaySource } from "@functions/lib/query-gateway";
import { createObjectKey, getObject, putObject } from "@functions/lib/r2-client";
import type { LteEnv } from "@functions/lib/types";
import { z } from "zod";
import { certificateLogger, logCertificateFailure } from "./logging";
import { renderPdf } from "./pdfRenderer";
import { certificateInternalReadPolicy, certificatePdfUpdatePolicy } from "./queries";
import { registerCertificateUpload } from "./storageCleanup";
import { CERTIFICATE_TEMPLATE_VERSION, certificateHtml } from "./template";
import type { CertificateRow } from "./types";
export class CertificateDownloadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
function assertIssued(row: CertificateRow | null) {
  if (!row) throw new CertificateDownloadError(404, "NOT_FOUND");
  if (row.status === "pending_name") throw new CertificateDownloadError(409, "NAME_REQUIRED");
  if (row.status === "revoked") throw new CertificateDownloadError(410, "CERTIFICATE_REVOKED");
}
export async function certificatePdf(
  source: QueryGatewaySource,
  env: LteEnv,
  row: CertificateRow,
  requestId: string,
  traceparent?: string,
): Promise<Response> {
  assertIssued(row);
  const qb = asQueryGateway(source);
  const started = Date.now();
  let body: BodyInit | null = null;
  if (row.pdf_object_key && row.pdf_template_version === CERTIFICATE_TEMPLATE_VERSION) {
    const cached = (await getObject(env, row.pdf_object_key)) as { body: ReadableStream } | null;
    body = cached?.body ?? null;
  }
  if (!body) {
    let uploadedKey: string | null = null;
    try {
      const pdf = await renderPdf(env, certificateHtml(row, env.CERTIFICATE_VERIFY_BASE_URL), {
        requestId,
        traceparent,
      });
      const fileId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const key = createObjectKey({
        namespace: "certificates",
        ownerId: row.user_id,
        entityId: row.credential_id,
        fileId,
        fileName: "certificate.pdf",
      });
      await registerCertificateUpload(qb, row.id, key);
      await putObject(env, key, pdf, { contentType: "application/pdf" });
      uploadedKey = key;
      const updated = await qb.update<Array<{ id: string }>>(certificatePdfUpdatePolicy, {
        filters: [
          { column: "id", op: "eq", value: row.id },
          { column: "status", op: "eq", value: "issued" },
          {
            column: "pdf_object_key",
            op: row.pdf_object_key ? "eq" : "is",
            value: row.pdf_object_key,
          },
        ],
        data: {
          pdf_object_key: key,
          pdf_template_version: CERTIFICATE_TEMPLATE_VERSION,
          pdf_generated_at: new Date().toISOString(),
        },
      });
      // Revocation or erasure may race the remote render. Never serve its result.
      if (!updated?.length) {
        await env.STORAGE_BUCKET.delete(key);
        uploadedKey = null;
        assertIssued(
          await qb.read<CertificateRow | null>(certificateInternalReadPolicy, {
            filters: [{ column: "id", op: "eq", value: row.id }],
            result: "maybeSingle",
          }),
        );
        throw new CertificateDownloadError(503, "PDF_RENDER_UNAVAILABLE");
      }
      if (row.pdf_object_key && row.pdf_object_key !== key) {
        try {
          await env.STORAGE_BUCKET.delete(row.pdf_object_key);
        } catch (cleanupError) {
          logCertificateFailure(cleanupError, {
            requestId,
            certificateId: row.id,
            operation: "storage_cleanup",
            cleanup: "superseded_object",
          });
        }
      }
      body = pdf;
      certificateLogger.info("certificate.render", {
        requestId,
        certificateId: row.id,
        durationMs: Date.now() - started,
        bytes: pdf.byteLength,
        templateVersion: CERTIFICATE_TEMPLATE_VERSION,
        outcome: "success",
      });
    } catch (error) {
      if (uploadedKey) {
        try {
          const current = await qb.read<CertificateRow | null>(certificateInternalReadPolicy, {
            filters: [{ column: "id", op: "eq", value: row.id }],
            result: "maybeSingle",
          });
          if (current?.pdf_object_key !== uploadedKey) await env.STORAGE_BUCKET.delete(uploadedKey);
        } catch (cleanupError) {
          logCertificateFailure(cleanupError, {
            requestId,
            certificateId: row.id,
            operation: "storage_cleanup",
            cleanup: "failed_render_object",
          });
        }
      }
      logCertificateFailure(error, {
        requestId,
        certificateId: row.id,
        operation: "pdf_cache",
        durationMs: Date.now() - started,
        templateVersion: CERTIFICATE_TEMPLATE_VERSION,
        outcome: "failure",
      });
      throw error;
    }
  }
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${row.credential_id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": requestId,
    },
  });
}

/** Deletes every certificate PDF for an erased learner, including stale and orphaned versions. */
export async function eraseCertificatePdfsForUser(env: LteEnv, userId: string): Promise<number> {
  const safeUserId = z.uuid().parse(userId);
  const prefix = createObjectKey({ namespace: "certificates", ownerId: safeUserId });
  const list = env.STORAGE_BUCKET.list;
  if (!list) throw new Error("STORAGE_BUCKET list binding is required for certificate erasure");
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await list.call(env.STORAGE_BUCKET, { prefix: `${prefix}/`, cursor, limit: 1000 });
    const keys = page.objects.map((object) => object.key);
    if (keys.length) {
      await env.STORAGE_BUCKET.delete(keys);
      deleted += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
    if (page.truncated && !cursor) throw new Error("R2 listing truncated without a cursor");
  } while (cursor);
  return deleted;
}
