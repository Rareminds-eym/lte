import { z } from "zod";

const requestIdSchema = z
  .string()
  .regex(/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i);
const traceSchema = z
  .string()
  .regex(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/)
  .refine(
    (value) =>
      !value.includes("-00000000000000000000000000000000-") &&
      !value.includes("-0000000000000000-"),
  );

/** Only opaque, bounded identifiers may be reflected into logs or headers. */
export function requestCorrelation(request: Request, data?: Record<string, unknown>) {
  const trace = traceSchema.safeParse(data?.["traceparent"] ?? request.headers.get("traceparent"));
  const id = requestIdSchema.safeParse(data?.["requestId"] ?? request.headers.get("X-Request-Id"));
  const traceparent = trace.success
    ? trace.data
    : `00-${crypto.randomUUID().replaceAll("-", "")}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}-01`;
  return { traceparent, requestId: id.success ? id.data : traceparent.split("-")[1]! };
}
