import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { XpModalProvider } from "@/app/providers/XpModalProvider";
import { useXpModalStore } from "@/shared/store";

describe("XpModalProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useXpModalStore.getState().clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders null when there is no current event", () => {
    const { container } = render(<XpModalProvider />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the XpRewardModal when an event is added to the store", () => {
    render(<XpModalProvider />);

    act(() => {
      useXpModalStore.getState().addEvent({
        id: "test-event",
        xpAmount: 25,
        totalXp: 150,
        eventType: "daily_login",
        xpCategory: "engagement",
      });
    });

    // Fast-forward past the addEvent timeout (100ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText("+25")).toBeInTheDocument();
    expect(screen.getByText(/ENGAGEMENT XP/)).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });
});
