export class QueryGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "QueryGatewayError";
  }
}

export class QueryGatewayDatabaseError extends QueryGatewayError {
  constructor(message: string, cause: unknown) {
    super(message, "QUERY_GATEWAY_DATABASE_ERROR", 500, cause);
    this.name = "QueryGatewayDatabaseError";
  }
}
