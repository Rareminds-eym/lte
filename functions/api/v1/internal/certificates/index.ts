import { certificateError } from "@functions/lib/certificates/http";
import {
  internalError,
  internalErrorResponse,
  internalItem,
  internalPage,
  internalQuerySchema,
  internalResponseSchema,
} from "@functions/lib/certificates/internal";
import { certificateLogger } from "@functions/lib/certificates/logging";
import { jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const requestId = String(context.data?.["requestId"] ?? crypto.randomUUID());
  if (context.data?.["certificateServiceApp"] !== "skillpassport")
    return internalError("UNAUTHORIZED", "Service authentication required", 401, requestId);
  try {
    const query = internalQuerySchema.parse(
      Object.fromEntries(new URL(context.request.url).searchParams),
    );
    const page = await internalPage(createServiceQueryGateway(context.env), query);
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
    return jsonResponse(internalResponseSchema.parse({ ok: true, data }), {
      headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId },
    });
  } catch (error) {
    return internalErrorResponse(certificateError(error, requestId));
  }
}
