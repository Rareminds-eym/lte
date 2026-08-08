import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LightbulbIcon } from "@/shared/ui";
import { STAGE_STEPS, StageStepperBar } from "@/widgets/stage-stepper-bar";

describe("StageStepperBar Widget", () => {
  it("renders all 6E stages with correct titles and subtitles", () => {
    render(<StageStepperBar activeStage="engage" />);

    STAGE_STEPS.forEach((step) => {
      expect(screen.getByText(step.label)).toBeInTheDocument();
      expect(screen.getByText(step.subtitle)).toBeInTheDocument();
    });
  });

  it("highlights the active stage step", () => {
    render(<StageStepperBar activeStage="explore" />);

    const exploreLabel = screen.getByText("Explore");
    expect(exploreLabel).toHaveClass("text-brand-600");
  });

  it("triggers onStageSelect when a stage step is clicked", () => {
    const onSelect = vi.fn();
    render(<StageStepperBar activeStage="engage" onStageSelect={onSelect} />);

    const exploreBtn = screen.getByRole("button", { name: /explore/i });
    fireEvent.click(exploreBtn);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("explore");
  });

  it("uses dynamic stage subtitles when provided", () => {
    render(
      <StageStepperBar
        activeStage="engage"
        stageOverrides={{
          engage: {
            subtitle: "Final Artifact",
            icon: LightbulbIcon,
          },
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /engage final artifact/i })).toBeInTheDocument();
  });
});
