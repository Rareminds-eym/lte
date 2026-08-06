import { create } from "zustand";
import { getLogger } from "@/shared";
import type { ActiveTrackDetail } from "@/shared/types/auth";
import { activateLearningTrack, fetchActiveLearningPath } from "../api/learningPathApi";

const logger = getLogger("learningPathStore");

interface LearningPathState {
  userId: string | null;
  activeTrack: ActiveTrackDetail | null;
  activeLearningPathLoading: boolean;
  needsAssessment: boolean;
  error: string | null;
  fetchAndSetActiveLearningPath: (userId: string) => Promise<void>;
  switchActiveTrack: (trackId: string) => Promise<void>;
  clearActiveLearningPath: () => void;
}

export const useLearningPathStore = create<LearningPathState>((set, get) => ({
  userId: null,
  activeTrack: null,
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
        activeTrack: result.data,
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
        activeTrack: null,
        activeLearningPathLoading: false,
        needsAssessment: false,
        error: message,
      });
    }
  },

  switchActiveTrack: async (trackId: string) => {
    const userId = get().userId;
    if (!userId) return;
    logger.info("switchActiveTrack triggered", { trackId, userId });
    set({ activeLearningPathLoading: true, error: null });
    try {
      await activateLearningTrack(trackId);
      const result = await fetchActiveLearningPath();
      if (get().userId !== userId) {
        logger.info("switchActiveTrack user changed during fetch, ignoring result");
        return;
      }
      set({
        activeTrack: result.data,
        needsAssessment: result.needsAssessment,
        activeLearningPathLoading: false,
      });
      logger.info("switchActiveTrack succeeded", { trackId });
    } catch (error) {
      if (get().userId !== userId) {
        logger.info("switchActiveTrack user changed during fetch error, ignoring error");
        return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to switch active learning track";
      logger.error("switchActiveTrack failed", error instanceof Error ? error : new Error(message));
      set({
        activeLearningPathLoading: false,
        error: message,
      });
      throw error;
    }
  },

  clearActiveLearningPath: () => {
    logger.info("clearActiveLearningPath");
    set({
      userId: null,
      activeTrack: null,
      activeLearningPathLoading: false,
      needsAssessment: false,
      error: null,
    });
  },
}));
