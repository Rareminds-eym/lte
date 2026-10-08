import { QueryGatewayDatabaseError } from "@functions/lib/query-gateway";
import { createLogger } from "@functions/shared/logger";
export const certificateLogger = createLogger("certificates");
export function errorCode(error: unknown): string {
  if (
    error instanceof QueryGatewayDatabaseError &&
    error.cause &&
    typeof error.cause === "object" &&
    "code" in error.cause
  )
    return String(error.cause.code);
  return "CERTIFICATE_ERROR";
}
export function logCertificateFailure(error: unknown, fields: Record<string, unknown>): void {
  const code = errorCode(error);
  certificateLogger.error(
    code === "23514" ? "certificate.immutability_violation" : "certificate.issue_failed",
    undefined,
    {
      ...fields,
      requestId:
        typeof fields["requestId"] === "string" ? fields["requestId"] : crypto.randomUUID(),
      errorCode: code,
    },
  );
}
