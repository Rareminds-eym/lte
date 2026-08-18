import { QueryGatewayError } from "./errors";

export function pickAllowedPayload(
  payload: Record<string, unknown>,
  allowedColumns: readonly string[],
  context: string,
  ownershipColumn?: string,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === ownershipColumn) {
      throw new QueryGatewayError(
        `${context} payload cannot provide ownership column: ${key}`,
        "OWNERSHIP_PAYLOAD_NOT_ALLOWED",
      );
    }

    if (!allowedColumns.includes(key)) {
      throw new QueryGatewayError(`${context} column not allowed: ${key}`, "COLUMN_NOT_ALLOWED");
    }

    sanitized[key] = value;
  }

  if (Object.keys(sanitized).length === 0) {
    throw new QueryGatewayError(`${context} payload cannot be empty`, "EMPTY_PAYLOAD");
  }

  return sanitized;
}
