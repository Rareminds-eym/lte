import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RadioButton, RadioGroup } from "../../../shared/ui/RadioButton";

describe("RadioButton", () => {
  it("renders label and description correctly", () => {
    render(
      <RadioButton id="test-radio" name="test" label="Test Label" description="Test Description" />,
    );

    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  it("handles checked and disabled states", () => {
    render(<RadioButton id="test-radio" name="test" checked disabled label="Disabled Radio" />);

    const input = screen.getByRole("radio");
    expect(input).toBeChecked();
    expect(input).toBeDisabled();
  });
});

describe("RadioGroup", () => {
  const options = [
    { value: "option1", label: "Option 1", description: "First choice" },
    { value: "option2", label: "Option 2", description: "Second choice" },
  ];

  it("renders all options in group and handles change", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <RadioGroup
        name="test-group"
        label="Select Option"
        options={options}
        value="option1"
        onChange={handleChange}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Select Option" })).toBeInTheDocument();
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();

    const secondRadio = screen.getByDisplayValue("option2");
    await user.click(secondRadio);

    expect(handleChange).toHaveBeenCalledWith("option2");
  });
});
