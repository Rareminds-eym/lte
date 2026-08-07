import type React from "react";
import type { LteStage } from "@/entities/course";
import { updateStageProgress } from "@/entities/course";
import { useContentTimer } from "@/shared/hooks";

interface SilentContentTimerProps {
  contentId: string;
  levelId: string;
  moduleNo: number;
  stageName: LteStage;
  updateStage: (payload: {
    levelId: string;
    moduleNo: number;
    eContentId: string;
    stageName: LteStage;
    status: "in_progress" | "completed";
    durationSeconds?: number;
  }) => void;
}

export const SilentContentTimer: React.FC<SilentContentTimerProps> = ({
  contentId,
  levelId,
  moduleNo,
  stageName,
  updateStage,
}) => {
  useContentTimer({
    contentId,
    onTimerEnd: (durationSeconds, reason) => {
      if (reason === "page-exit") {
        void updateStageProgress(
          levelId,
          moduleNo,
          contentId,
          stageName,
          "in_progress",
          durationSeconds,
          {
            keepalive: true,
          },
        );
        return;
      }

      updateStage({
        levelId,
        moduleNo,
        eContentId: contentId,
        stageName,
        status: "in_progress",
        durationSeconds,
      });
    },
  });

  return null;
};
