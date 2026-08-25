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

  it("renders engagement variant correctly", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={20}
        totalXp={200}
        stageName="explore"
        onClose={handleClose}
        xpCategory="engagement"
      />,
    );

    expect(screen.getByText("+20")).toBeInTheDocument();
    expect(screen.getByText(/ENGAGEMENT XP/)).toBeInTheDocument();
    expect(screen.getByText(/You earned engagement XP/)).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("renders daily login engagement variant correctly", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={1}
        totalXp={150}
        stageName="daily_login"
        onClose={handleClose}
        xpCategory="engagement"
      />,
    );

    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText(/daily active login/)).toBeInTheDocument();
  });

  it("renders streak engagement variant correctly", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={5}
        totalXp={155}
        stageName="streak_7_day"
        onClose={handleClose}
        xpCategory="engagement"
      />,
    );

    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByText(/7 consecutive days/)).toBeInTheDocument();
  });

  it("renders consistency engagement variant correctly", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={30}
        totalXp={185}
        stageName="consistency_30_day"
        onClose={handleClose}
        xpCategory="engagement"
      />,
    );

    expect(screen.getByText("+30")).toBeInTheDocument();
    expect(screen.getByText(/30 consecutive days/)).toBeInTheDocument();
  });

  it("renders practice artifact accepted variant correctly", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={2}
        totalXp={45}
        stageName="practice_artifact_accepted"
        onClose={handleClose}
        xpCategory="evidence"
      />,
    );

    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText(/practice artifact submission has been evaluated/)).toBeInTheDocument();
  });

  it("renders final artifact accepted variant correctly", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={20}
        totalXp={100}
        stageName="final_artifact_accepted_1"
        onClose={handleClose}
        xpCategory="evidence"
      />,
    );

    expect(screen.getByText("+20")).toBeInTheDocument();
    expect(screen.getByText(/final artifact submission was accepted/)).toBeInTheDocument();
  });

  it("renders readiness milestone engagement variant correctly", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={10}
        totalXp={250}
        stageName="readiness_milestone_50"
        onClose={handleClose}
        xpCategory="engagement"
      />,
    );

    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText(/achieved the 50% readiness milestone/)).toBeInTheDocument();
  });

  it("renders capstone completed variant correctly", () => {
    const handleClose = vi.fn();
    render(
      <XpRewardModal
        isOpen={true}
        xpAmount={50}
        totalXp={500}
        stageName="capstone_completed"
        onClose={handleClose}
        xpCategory="evidence"
      />,
    );

    expect(screen.getByText("+50")).toBeInTheDocument();
    expect(screen.getByText(/completing your Capstone project/)).toBeInTheDocument();
  });
});
