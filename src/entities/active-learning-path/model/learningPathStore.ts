import { create } from "zustand";
import { getLogger } from "@/shared";
import type { ActiveLearningPath } from "@/shared/types/auth";
import { fetchActiveLearningPath } from "../api/learningPathApi";

const logger = getLogger("learningPathStore");

interface LearningPathState {
  userId: string | null;
  activeLearningPath: ActiveLearningPath | null;
  activeLearningPathLoading: boolean;
  needsAssessment: boolean;
  error: string | null;
  fetchAndSetActiveLearningPath: (userId: string) => Promise<void>;
  clearActiveLearningPath: () => void;
}

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  userId: null,
  activeLearningPath: null,
  activeLearningPathLoading: false,
  needsAssessment: false,
  error: null,

  fetchAndSetActiveLearningPath: async (userId: string) => {
    logger.info("fetchAndSetActiveLearningPath triggered", { userId });
    set({ activeLearningPathLoading: true, error: null, userId });
    try {
      const result = await fetchActiveLearningPath();
      if (get().userId !== userId) {
        logger.info("fetchAndSetActiveLearningPath user changed during fetch, ignoring result");
        return;
      }
      set({
        activeLearningPath: result.data,
        needsAssessment: result.needsAssessment,
        activeLearningPathLoading: false,
      });
      logger.info("fetchAndSetActiveLearningPath succeeded", {
        hasPath: !!result.data,
        needsAssessment: result.needsAssessment,
      });
    } catch (error) {
      if (get().userId !== userId) {
        logger.info(
          "fetchAndSetActiveLearningPath user changed during fetch error, ignoring error",
        );
        return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to load active learning path";
      logger.error(
        "fetchAndSetActiveLearningPath failed",
        error instanceof Error ? error : new Error(message),
      );
      set({
        activeLearningPath: null,
        activeLearningPathLoading: false,
        needsAssessment: false,
        error: message,
      });
    }
  },

  clearActiveLearningPath: () => {
    logger.info("clearActiveLearningPath");
    set({
      userId: null,
      activeLearningPath: null,
      activeLearningPathLoading: false,
      needsAssessment: false,
      error: null,
    });
  },
}));
