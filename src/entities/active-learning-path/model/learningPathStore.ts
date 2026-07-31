import { create } from "zustand";
import { getLogger } from "@/shared";
import type { ActiveLearningPath } from "@/shared/types/auth";
import { fetchActiveLearningPath } from "../api/learningPathApi";

const logger = getLogger("learningPathStore");

interface LearningPathState {
  activeLearningPath: ActiveLearningPath | null;
  activeLearningPathLoading: boolean;
  error: string | null;
  fetchAndSetActiveLearningPath: () => Promise<void>;
  clearActiveLearningPath: () => void;
}

export const useLearningPathStore = create<LearningPathState>((set) => ({
  activeLearningPath: null,
  activeLearningPathLoading: false,
  error: null,

  fetchAndSetActiveLearningPath: async () => {
    logger.info("fetchAndSetActiveLearningPath triggered");
    set({ activeLearningPathLoading: true, error: null });
    try {
      const path = await fetchActiveLearningPath();
      set({ activeLearningPath: path, activeLearningPathLoading: false });
      logger.info("fetchAndSetActiveLearningPath succeeded", { hasPath: !!path });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load active learning path";
      logger.error(
        "fetchAndSetActiveLearningPath failed",
        error instanceof Error ? error : new Error(message),
      );
      set({ activeLearningPath: null, activeLearningPathLoading: false, error: message });
    }
  },

  clearActiveLearningPath: () => {
    logger.info("clearActiveLearningPath");
    set({ activeLearningPath: null, activeLearningPathLoading: false, error: null });
  },
}));
