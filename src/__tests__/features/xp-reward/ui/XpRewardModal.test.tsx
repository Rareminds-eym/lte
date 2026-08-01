import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { XpRewardModal } from "@/features/xp-reward";

describe("XpRewardModal", () => {
  it("renders correctly when open", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={50}
        totalXp={125}
        stageName="explore"
        onClose={handleClose}
      />,
    );

    expect(screen.getByText("+50")).toBeInTheDocument();
    expect(screen.getByText("XP Earned!")).toBeInTheDocument();
    expect(screen.getByText(/READINESS XP/)).toBeInTheDocument();
    expect(screen.getByText(/You completed the/)).toBeInTheDocument();
    expect(screen.getByText("explore")).toBeInTheDocument();
    expect(screen.getByText("125")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue/i })).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    const handleClose = vi.fn();
    const { container } = render(
      <XpRewardModal
        isOpen={false}
        xpAmount={50}
        totalXp={125}
        stageName="explore"
        onClose={handleClose}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("triggers onClose callback when continue button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={50}
        totalXp={125}
        stageName="explore"
        onClose={handleClose}
      />,
    );

    const button = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(button);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
