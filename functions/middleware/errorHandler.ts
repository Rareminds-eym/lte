// Global error handler middleware

export interface ApiError {
  statusCode: number;
  message: string;
  details?: string;
}

export const handleError = (error: unknown): ApiError => {
  if (error instanceof Error) {
    return {
      statusCode: 500,
      message: "Internal Server Error",
      details: error.message,
    };
  }

  return {
    statusCode: 500,
    message: "Internal Server Error",
  };
};

export const validateRequest = <T>(data: unknown, schema: { parse: (data: unknown) => T }): T => {
  return schema.parse(data);
};
