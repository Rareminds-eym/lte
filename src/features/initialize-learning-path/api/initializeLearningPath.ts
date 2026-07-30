import { z } from "zod";
import { ApiError, getLogger } from "@/shared";
import type { InitializeLearningPathPayload } from "../model/initializeLearningPath.schema";

const apiLogger = getLogger("api");

const initializeLearningPathResponseSchema = z.object({
  learningTrackId: z.string(),
  learningPathId: z.string(),
});

export type InitializeLearningPathResponse = z.infer<typeof initializeLearningPathResponseSchema>;

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

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
    const errorData: ApiErrorResponse | null = await response.json().catch((err) => {
      apiLogger.error("Failed to parse API error response as JSON", err);
      return null;
    });

    throw new ApiError(
      errorData?.error?.message || `Request failed with status ${response.status}.`,
      response.status,
    );
  }

  const data = await response.json();
  const parsed = initializeLearningPathResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError("Invalid response format from server");
  }

  return parsed.data;
};
