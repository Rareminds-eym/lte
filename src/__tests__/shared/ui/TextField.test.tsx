import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "../../../shared/ui/TextField";

describe("TextField", () => {
  it("renders label and input correctly", () => {
    render(<TextField id="test-field" label="Test Label" />);

    expect(screen.getByLabelText("Test Label")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "test-field");
  });

  it("groups label and input under a single wrapper", () => {
    const { container } = render(<TextField id="test-field" label="Test Label" />);

    const wrapper = screen.getByLabelText("Test Label").parentElement;
    expect(wrapper).toBe(container.firstElementChild);
    expect(wrapper?.contains(screen.getByRole("textbox"))).toBe(true);
  });

  it("handles text input changes", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<TextField id="test-field" label="Test Label" onChange={handleChange} />);

    await user.type(screen.getByLabelText("Test Label"), "hello");
    expect(handleChange).toHaveBeenCalled();
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("renders read-only input when readOnly is set", () => {
    render(<TextField id="test-field" label="Test Label" value="fixed" readOnly />);

    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("fixed")).toBeInTheDocument();
  });
});
