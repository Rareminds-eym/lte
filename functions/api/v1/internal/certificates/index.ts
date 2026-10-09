import {
  certificateError,
  certificateLogger,
  certificateRequestContext,
  correlateResponse,
  correlationHeaders,
  internalError,
  internalErrorResponse,
  internalItem,
  internalPage,
  internalQuerySchema,
  internalResponseSchema,
  parseCertificateData,
} from "@functions/lib/certificates";
import { jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const fallback = certificateRequestContext(context);
  const requestId = String(context.data?.["requestId"] ?? fallback.requestId);
  const traceparent = String(context.data?.["traceparent"] ?? fallback.traceparent);
  if (context.data?.["certificateServiceApp"] !== "skillpassport")
    return internalError("UNAUTHORIZED", "Service authentication required", 401, requestId);
  try {
    const query = internalQuerySchema.parse(
      Object.fromEntries(new URL(context.request.url).searchParams),
    );
    const page = await internalPage(
      createServiceQueryGateway(context.env, { requestId, traceparent }),
      query,
    );
    const data = {
      items: page.rows.map((row) => internalItem(row, context.env)),
      nextCursor: page.nextCursor,
    };
    certificateLogger.info("certificate.internal_read", {
      requestId,
      app: "skillpassport",
      mode: query.userId ? "user" : "incremental",
      count: data.items.length,
    });
    return jsonResponse(parseCertificateData(internalResponseSchema, { ok: true, data }), {
      headers: {
        "Cache-Control": "private, no-store",
        ...correlationHeaders(requestId, traceparent),
      },
    });
  } catch (error) {
    return correlateResponse(
      await internalErrorResponse(certificateError(error, requestId)),
      requestId,
      traceparent,
    );
  }
}
