import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "@/shared/ui";

describe("SegmentedControl", () => {
  const defaultProps = {
    value: "card",
    onChange: vi.fn(),
    ariaLabel: "Display type",
    options: [
      { value: "card", label: "Cards" },
      { value: "list", label: "List" },
    ],
  };

  it("renders role group with aria-label", () => {
    render(<SegmentedControl {...defaultProps} />);
    const group = screen.getByRole("group", { name: "Display type" });
    expect(group).toBeInTheDocument();
  });

  it("renders all options with appropriate aria-pressed states", () => {
    render(<SegmentedControl {...defaultProps} />);
    const cardsBtn = screen.getByRole("button", { name: "Cards" });
    const listBtn = screen.getByRole("button", { name: "List" });

    expect(cardsBtn).toHaveAttribute("aria-pressed", "true");
    expect(listBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with option value when clicked", () => {
    const onChange = vi.fn();
    render(<SegmentedControl {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });
});
