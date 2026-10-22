import type { PagesContext } from "@functions/lib/types";
import { requestCorrelation } from "@functions/middleware";
import { internalServiceEnvSchema } from "@functions/schemas/internalService";
import {
  INTERNAL_SERVICE_MESSAGES as messages,
  INTERNAL_SERVICE_POLICY as policy,
} from "@functions/shared/internalServiceConfig";
import { apiLogger } from "@functions/shared/logger";
import { boundedBody } from "./http";

export type InternalCorrelation = ReturnType<typeof requestCorrelation>;
/** Signed service authentication, scoped to the exact method/path/body. */
export function internalEndpoint(
  handle: (
    context: PagesContext,
    body: string,
    correlation: InternalCorrelation,
  ) => Promise<Response>,
  maxBodyBytes: number = policy.maxBodyBytes,
) {
  return async (context: PagesContext): Promise<Response> => {
    const correlation = requestCorrelation(context.request, context.data);
    const finish = (response: Response) => {
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Request-Id", correlation.requestId);
      response.headers.set("traceparent", correlation.traceparent);
      return response;
    };
    const failure = (error: string, status: number) =>
      finish(Response.json({ error, requestId: correlation.requestId }, { status }));
    const config = internalServiceEnvSchema.safeParse(context.env);
    if (!config.success) return failure(messages.notConfigured, 503);
    const timestamp = context.request.headers.get("x-lte-timestamp") || "";
    const signature = context.request.headers.get("x-lte-signature") || "";
    if (
      !/^\d{13}$/.test(timestamp) ||
      Math.abs(Date.now() - Number(timestamp)) > policy.freshnessMs ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      return failure(messages.unauthorized, 401);
    // Body errors are classified here only; downstream SyntaxError/RangeError are server failures.
    let body: string;
    try {
      body = await boundedBody(context.request, maxBodyBytes);
    } catch (error) {
      if (error instanceof RangeError) return failure(messages.tooLarge, 413);
      apiLogger.error(messages.operationFailed, error, correlation);
      return failure(messages.unavailable, 503);
    }
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(config.data.LTE_CATALOG_SYNC_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        Uint8Array.from(signature.match(/../g) ?? [], (value) => parseInt(value, 16)),
        new TextEncoder().encode(
          `${context.request.method}\n${new URL(context.request.url).pathname}\n${timestamp}\n${body}`,
        ),
      );
      if (!valid) return failure(messages.unauthorized, 401);
      // All current signed operations use JSON. Validate syntax before downstream work.
      try {
        JSON.parse(body);
      } catch {
        return failure(messages.invalidJson, 400);
      }
      return finish(await handle(context, body, correlation));
    } catch (error) {
      apiLogger.error(messages.operationFailed, error, correlation);
      return failure(messages.unavailable, 503);
    }
  };
}
