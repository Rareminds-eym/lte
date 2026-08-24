import type React from "react";
import { XpRewardModal } from "@/features/xp-reward";
import { useXpModalStore } from "@/shared/store";

export const XpModalProvider: React.FC = () => {
  const { currentEvent, closeModal } = useXpModalStore();

  if (!currentEvent) {
    return null;
  }

  return (
    <XpRewardModal
      isOpen={true}
      xpAmount={currentEvent.xpAmount}
      totalXp={currentEvent.totalXp}
      stageName={currentEvent.eventType}
      xpCategory={currentEvent.xpCategory}
      onClose={closeModal}
    />
  );
};
