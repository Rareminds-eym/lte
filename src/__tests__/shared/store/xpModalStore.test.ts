import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useXpModalStore } from "@/shared/store";

describe("xpModalStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useXpModalStore.getState().clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("initializes with empty queue and null current event", () => {
    const state = useXpModalStore.getState();
    expect(state.pendingEvents).toEqual([]);
    expect(state.currentEvent).toBeNull();
    expect(state.shownEventIds.size).toBe(0);
  });

  it("adds an event and automatically displays it after a small delay", () => {
    const onCloseMock = vi.fn();
    const event = {
      id: "event-1",
      xpAmount: 10,
      totalXp: 100,
      eventType: "explore",
      xpCategory: "evidence" as const,
      onClose: onCloseMock,
    };

    useXpModalStore.getState().addEvent(event);

    // Initial state before timer fires (currentEvent is scheduled, not set instantly)
    expect(useXpModalStore.getState().pendingEvents).toEqual([event]);
    expect(useXpModalStore.getState().currentEvent).toBeNull();

    // Fast-forward time
    vi.advanceTimersByTime(100);

    expect(useXpModalStore.getState().currentEvent).toEqual(event);
    expect(useXpModalStore.getState().pendingEvents).toEqual([]);
  });

  it("does not add an event that has already been shown", () => {
    const state = useXpModalStore.getState();
    state.markAsShown("event-1");

    const event = {
      id: "event-1",
      xpAmount: 10,
      totalXp: 100,
      eventType: "explore",
      xpCategory: "evidence" as const,
    };

    useXpModalStore.getState().addEvent(event);
    vi.advanceTimersByTime(100);

    expect(useXpModalStore.getState().currentEvent).toBeNull();
    expect(useXpModalStore.getState().pendingEvents).toEqual([]);
  });

  it("queues multiple events and displays them in sequence", () => {
    const event1 = {
      id: "event-1",
      xpAmount: 10,
      totalXp: 100,
      eventType: "explore",
      xpCategory: "evidence" as const,
    };
    const event2 = {
      id: "event-2",
      xpAmount: 20,
      totalXp: 120,
      eventType: "streak_7_day",
      xpCategory: "engagement" as const,
    };

    useXpModalStore.getState().addEvent(event1);
    useXpModalStore.getState().addEvent(event2);

    // Advance to show event1
    vi.advanceTimersByTime(100);
    expect(useXpModalStore.getState().currentEvent).toEqual(event1);
    expect(useXpModalStore.getState().pendingEvents).toEqual([event2]);

    // Close event1
    useXpModalStore.getState().closeModal();
    expect(useXpModalStore.getState().currentEvent).toBeNull();
    expect(useXpModalStore.getState().shownEventIds.has("event-1")).toBe(true);

    // Advance to trigger event2 display
    vi.advanceTimersByTime(400);
    expect(useXpModalStore.getState().currentEvent).toEqual(event2);
    expect(useXpModalStore.getState().pendingEvents).toEqual([]);

    // Close event2
    useXpModalStore.getState().closeModal();
    expect(useXpModalStore.getState().currentEvent).toBeNull();
    expect(useXpModalStore.getState().shownEventIds.has("event-2")).toBe(true);
  });

  it("executes the onClose callback when the modal is closed", () => {
    const onCloseMock = vi.fn();
    const event = {
      id: "event-1",
      xpAmount: 15,
      totalXp: 50,
      eventType: "design",
      xpCategory: "evidence" as const,
      onClose: onCloseMock,
    };

    useXpModalStore.getState().addEvent(event);
    vi.advanceTimersByTime(100);

    useXpModalStore.getState().closeModal();

    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(useXpModalStore.getState().shownEventIds.has("event-1")).toBe(true);
  });
});
