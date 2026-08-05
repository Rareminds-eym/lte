import { z } from "zod";
import { ApiError, apiFetch } from "@/shared/api";
import type { InitializeLearningPathPayload } from "../model/initializeLearningPath.schema";

const activateTrackResponseSchema = z.object({
  success: z.literal(true),
});

export const initializeLearningPath = async ({
  payload,
  signal,
}: {
  payload: InitializeLearningPathPayload;
  signal?: AbortSignal;
}): Promise<void> => {
  const raw = await apiFetch("/api/v1/learning-paths/active-track", {
    method: "PATCH",
    body: JSON.stringify({ trackId: payload.trackId }),
    signal,
  });

  const parsed = activateTrackResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("Invalid response format from server");
  }
};
