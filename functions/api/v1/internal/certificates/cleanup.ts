import {
  certificateError,
  certificateRequestContext,
  correlateResponse,
  drainCertificateStorageCleanup,
  internalError,
  internalErrorResponse,
} from "@functions/lib/certificates";
import { jsonResponse } from "@functions/lib/http";
import { createServiceQueryGateway } from "@functions/lib/query-gateway";
import type { PagesContext } from "@functions/lib/types";
import { certificateCleanupRequestSchema as emptySchema } from "@functions/schemas";
import { z } from "zod";

/** Operations-only bounded queue drain; a read token cannot authorize this action. */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { requestId, traceparent } = certificateRequestContext(context);
  try {
    if (context.data?.["certificateServiceApp"] !== "lte-maintenance")
      return correlateResponse(
        internalError("FORBIDDEN", "Maintenance access required", 403, requestId),
        requestId,
        traceparent,
      );
    emptySchema.parse(Object.fromEntries(new URL(context.request.url).searchParams));
    if (context.request.body) {
      const text = z
        .string()
        .max(1024)
        .parse(await context.request.text());
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new z.ZodError([{ code: "custom", path: [], message: "Invalid maintenance body" }]);
      }
      emptySchema.parse(body);
    }
    const processed = await drainCertificateStorageCleanup(
      createServiceQueryGateway(context.env, { requestId, traceparent }),
      context.env,
      requestId,
    );
    return correlateResponse(
      jsonResponse({ ok: true, data: { processed }, requestId }),
      requestId,
      traceparent,
    );
  } catch (error) {
    return correlateResponse(
      await internalErrorResponse(certificateError(error, requestId)),
      requestId,
      traceparent,
    );
  }
}
