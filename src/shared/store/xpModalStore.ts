import { create } from "zustand";
import { getLogger } from "@/shared/config/logging";

const logger = getLogger("xpModalStore");

export interface XpEvent {
  id: string;
  xpAmount: number;
  totalXp: number;
  eventType: string;
  xpCategory: "evidence" | "engagement";
  onClose?: () => void;
}

interface XpModalStore {
  pendingEvents: XpEvent[];
  currentEvent: XpEvent | null;
  shownEventIds: Set<string>;
  addEvent: (event: XpEvent) => void;
  showNext: () => void;
  closeModal: () => void;
  markAsShown: (eventId: string) => void;
  clearAll: () => void;
}

export const useXpModalStore = create<XpModalStore>((set, get) => ({
  pendingEvents: [],
  currentEvent: null,
  shownEventIds: new Set<string>(),

  addEvent: (event) => {
    const { shownEventIds, pendingEvents, currentEvent } = get();

    // Prevent adding if it has already been shown in this session
    if (shownEventIds.has(event.id)) {
      return;
    }

    // Add to pending queue
    set({ pendingEvents: [...pendingEvents, event] });

    // If no modal is currently displayed and queue was empty, schedule showNext
    if (!currentEvent && pendingEvents.length === 0) {
      setTimeout(() => get().showNext(), 100);
    }
  },

  showNext: () => {
    const { pendingEvents } = get();
    if (pendingEvents.length === 0) {
      return;
    }

    const [next, ...rest] = pendingEvents;
    set({
      currentEvent: next,
      pendingEvents: rest,
    });
  },

  closeModal: () => {
    const { currentEvent } = get();
    if (currentEvent) {
      get().markAsShown(currentEvent.id);
      try {
        currentEvent.onClose?.();
      } catch (error) {
        logger.error(
          "Error executing XP modal onClose callback:",
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    set({ currentEvent: null });

    // Brief delay before showing the next modal to allow close animation to finish
    setTimeout(() => get().showNext(), 400);
  },

  markAsShown: (eventId) => {
    set((state) => {
      const nextSet = new Set(state.shownEventIds);
      nextSet.add(eventId);
      return { shownEventIds: nextSet };
    });
  },

  clearAll: () => {
    set({
      pendingEvents: [],
      currentEvent: null,
      shownEventIds: new Set<string>(),
    });
  },
}));
