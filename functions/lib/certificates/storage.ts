import { asQueryGateway, type QueryGatewaySource } from "@functions/lib/query-gateway";
import { createObjectKey, getObject, putObject } from "@functions/lib/r2-client";
import type { LteEnv } from "@functions/lib/types";
import { certificateLogger, logCertificateFailure } from "./logging";
import { renderPdf } from "./pdf-renderer";
import { certificateInternalReadPolicy, certificatePdfUpdatePolicy } from "./queries";
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
    try {
      const pdf = await renderPdf(env, certificateHtml(row, env.CERTIFICATE_VERIFY_BASE_URL!));
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
      await putObject(env, key, pdf, { contentType: "application/pdf" });
      const updated = await qb.update<Array<{ id: string }>>(certificatePdfUpdatePolicy, {
        filters: [
          { column: "id", op: "eq", value: row.id },
          { column: "status", op: "eq", value: "issued" },
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
        assertIssued(
          await qb.read<CertificateRow | null>(certificateInternalReadPolicy, {
            filters: [{ column: "id", op: "eq", value: row.id }],
            result: "maybeSingle",
          }),
        );
        throw new CertificateDownloadError(503, "PDF_RENDER_UNAVAILABLE");
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
      certificateLogger.error("certificate.render", undefined, {
        requestId,
        certificateId: row.id,
        durationMs: Date.now() - started,
        templateVersion: CERTIFICATE_TEMPLATE_VERSION,
        outcome: "failure",
      });
      logCertificateFailure(error, { requestId, certificateId: row.id, operation: "pdf_cache" });
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
