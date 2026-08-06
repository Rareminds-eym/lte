import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SegmentedProgressBar } from "@/shared/ui";

describe("SegmentedProgressBar", () => {
  it("renders correct number of segments and aria attributes", () => {
    render(<SegmentedProgressBar currentLevel={2} totalLevels={5} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "2");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "5");

    // Expect 5 segment children
    expect(progressbar.children).toHaveLength(5);
  });

  it("applies correct filled vs empty colors to segments", () => {
    const { container } = render(
      <SegmentedProgressBar
        currentLevel={3}
        totalLevels={5}
        barColor="bg-brand-600"
        emptyColor="bg-line-default"
      />,
    );

    const segments = container.querySelectorAll("[role='progressbar'] > div");
    expect(segments).toHaveLength(5);

    // First 3 segments should be filled
    expect(segments[0]).toHaveClass("bg-brand-600");
    expect(segments[1]).toHaveClass("bg-brand-600");
    expect(segments[2]).toHaveClass("bg-brand-600");

    // Remaining 2 segments should be empty
    expect(segments[3]).toHaveClass("bg-line-default");
    expect(segments[4]).toHaveClass("bg-line-default");
  });

  it("handles custom aria label", () => {
    render(
      <SegmentedProgressBar currentLevel={1} totalLevels={4} ariaLabel="Course Level Progress" />,
    );

    const progressbar = screen.getByRole("progressbar", { name: "Course Level Progress" });
    expect(progressbar).toBeInTheDocument();
  });

  it("renders an empty visual track while preserving zero total semantics", () => {
    render(<SegmentedProgressBar currentLevel={0} totalLevels={0} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "0");
    expect(progressbar.children).toHaveLength(1);
    expect(progressbar.children[0]).toHaveClass("bg-line-default");
  });
});
