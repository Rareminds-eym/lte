import { z } from "zod";

const traceSchema = z
  .string()
  .regex(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/)
  .refine(
    (value) =>
      !value.includes("-00000000000000000000000000000000-") &&
      !value.includes("-0000000000000000-"),
  );
const idSchema = z
  .string()
  .regex(/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i);

export function requestCorrelationHeaders(initial?: HeadersInit): Headers {
  const headers = new Headers(initial);
  const trace = traceSchema.safeParse(headers.get("traceparent"));
  const id = idSchema.safeParse(headers.get("X-Request-Id"));
  const traceparent = trace.success
    ? trace.data
    : `00-${crypto.randomUUID().replaceAll("-", "")}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}-01`;
  headers.set("traceparent", traceparent);
  headers.set("X-Request-Id", id.success ? id.data : traceparent.split("-")[1]!);
  return headers;
}
