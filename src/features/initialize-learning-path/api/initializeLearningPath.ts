import { z } from "zod";
import { ApiError, apiFetch } from "@/shared/api";
import type { InitializeLearningPathPayload } from "../model/initializeLearningPath.schema";

const initializeLearningPathResponseSchema = z.object({
  learningTrackId: z.string(),
  learningPathId: z.string(),
});

export type InitializeLearningPathResponse = z.infer<typeof initializeLearningPathResponseSchema>;

export const initializeLearningPath = async ({
  payload,
  signal,
}: {
  payload: InitializeLearningPathPayload;
  signal?: AbortSignal;
}): Promise<InitializeLearningPathResponse> => {
  const raw = await apiFetch("/api/v1/learning-paths/initialize", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });

  const parsed = initializeLearningPathResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("Invalid response format from server");
  }

  return parsed.data;
};
