import type { InitializeLearningPathPayload } from "../model/initializeLearningPath.schema";

type InitializeLearningPathResponse = {
  learningTrackId: string;
  learningPathId: string;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export class InitializeLearningPathError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "InitializeLearningPathError";
  }
}

export const initializeLearningPath = async ({
  payload,
  accessToken,
  signal,
}: {
  payload: InitializeLearningPathPayload;
  accessToken: string;
  signal?: AbortSignal;
}): Promise<InitializeLearningPathResponse> => {
  const response = await fetch("/api/v1/learning-paths/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorData: ApiErrorResponse | null = await response.json().catch(() => null);

    throw new InitializeLearningPathError(
      errorData?.error?.message || `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  const data = await response.json();
  return data as InitializeLearningPathResponse;
};
