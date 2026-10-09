import { QueryGatewayDatabaseError } from "@functions/lib/query-gateway";
import { createLogger } from "@functions/shared/logger";
export const certificateLogger = createLogger("certificates");
const loggedErrors = new WeakSet<object>();

export type CertificateFailureOperation =
  | "completion_hook"
  | "finalize"
  | "issue"
  | "list"
  | "pdf_cache"
  | "profile"
  | "rate_limit"
  | "reconcile"
  | "replace"
  | "revoke"
  | "storage_cleanup"
  | "verify";

const failureEvent: Record<CertificateFailureOperation, string> = {
  completion_hook: "certificate.issue_failed",
  finalize: "certificate.finalize_failed",
  issue: "certificate.issue_failed",
  list: "certificate.list_failed",
  pdf_cache: "certificate.render_failed",
  profile: "certificate.profile_reconcile_failed",
  rate_limit: "certificate.rate_limit_failed",
  reconcile: "certificate.reconcile_failed",
  replace: "certificate.replace_failed",
  revoke: "certificate.revoke_failed",
  storage_cleanup: "certificate.storage_cleanup_failed",
  verify: "certificate.verify_failed",
};
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
export function wasCertificateErrorLogged(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && loggedErrors.has(error));
}

export function logCertificateFailure(
  error: unknown,
  fields: Record<string, unknown> & { operation: CertificateFailureOperation },
): void {
  if (error && typeof error === "object") {
    if (loggedErrors.has(error)) return;
    loggedErrors.add(error);
  }
  const code = errorCode(error);
  const safeError = new Error(code);
  safeError.name = error instanceof Error ? error.name : "CertificateError";
  if (error instanceof Error && error.stack)
    safeError.stack = error.stack.replace(error.message, code);
  certificateLogger.error(
    code === "23514" ? "certificate.immutability_violation" : failureEvent[fields.operation],
    safeError,
    {
      ...fields,
      requestId:
        typeof fields["requestId"] === "string" ? fields["requestId"] : crypto.randomUUID(),
      errorCode: code,
    },
  );
}
