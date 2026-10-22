export const INTERNAL_SERVICE_POLICY = { maxBodyBytes: 16_384, freshnessMs: 60_000 } as const;
export const INTERNAL_SERVICE_MESSAGES = {
  notConfigured: "Catalog integration is not configured",
  unauthorized: "Unauthorized",
  tooLarge: "Request too large",
  invalidJson: "Invalid JSON",
  unavailable: "Catalog operation unavailable",
  operationFailed: "Internal service operation failed",
} as const;
