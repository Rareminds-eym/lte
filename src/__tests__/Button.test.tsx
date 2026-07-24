import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/shared/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("renders icon variant without children (icon-only)", () => {
    const { container } = render(<Button variant="icon" aria-label="close" />);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("rounded-full");
    expect(btn?.className).toContain("w-9 h-9");
  });

  it("renders icon variant with children (button with icon)", () => {
    render(<Button variant="icon">With text</Button>);
    const btn = screen.getByText("With text");
    expect(btn?.className).not.toContain("w-9 h-9");
  });

  it("renders icon element", () => {
    render(<Button icon={<span data-testid="test-icon" />}>Save</Button>);
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("applies size classes", () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("px-5");
  });

  it("applies variant classes", () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("bg-brand-50");
  });

  it("renders disabled button", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText("Disabled")).toBeDisabled();
  });

  it("applies additional className", () => {
    const { container } = render(<Button className="extra-class">Custom</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toContain("extra-class");
  });

  it("passes additional HTML attributes", () => {
    render(<Button data-testid="my-btn">Test</Button>);
    expect(screen.getByTestId("my-btn")).toBeInTheDocument();
  });
});
