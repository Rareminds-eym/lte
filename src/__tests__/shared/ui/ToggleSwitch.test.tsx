import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToggleSwitch } from "../../../shared/ui/ToggleSwitch";

describe("ToggleSwitch", () => {
  it("renders label and description correctly", () => {
    render(
      <ToggleSwitch
        id="test-toggle"
        checked={false}
        onChange={() => {}}
        label="Test Label"
        description="Test Description"
      />,
    );

    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("handles onChange when clicked", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ToggleSwitch
        id="test-toggle"
        checked={false}
        onChange={handleChange}
        label="Test Label"
        description="Test Description"
      />,
    );

    const switchBtn = screen.getByRole("switch");
    await user.click(switchBtn);

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("shows coming soon badge and calls onChange when comingSoon switch is clicked", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ToggleSwitch
        id="test-toggle"
        checked={false}
        onChange={handleChange}
        label="Coming Soon Item"
        description="Description"
        comingSoon
      />,
    );

    expect(screen.getByText("Coming Soon")).toBeInTheDocument();

    const switchBtn = screen.getByRole("switch");
    await user.click(switchBtn);

    expect(handleChange).toHaveBeenCalledWith(true);
  });
});
