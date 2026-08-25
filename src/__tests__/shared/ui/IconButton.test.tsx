import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconButton } from "@/shared/ui";

describe("IconButton", () => {
  it("renders icon", () => {
    render(<IconButton icon={<span data-testid="test-icon">*</span>} />);
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("renders badge when badgeCount is positive", () => {
    render(<IconButton icon={<span>i</span>} badgeCount={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("does not render badge when badgeCount is 0", () => {
    render(<IconButton icon={<span>i</span>} badgeCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("does not render badge when badgeCount is undefined", () => {
    const { container } = render(<IconButton icon={<span>i</span>} />);
    const badges = container.querySelectorAll("span");
    const badgeSpan = Array.from(badges).find((s) => s.className.includes("bg-rose-500"));
    expect(badgeSpan).toBeUndefined();
  });

  it("applies soft-blue variant classes by default", () => {
    render(<IconButton icon={<span>i</span>} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border-brand-200");
  });

  it("applies outline variant classes", () => {
    render(<IconButton icon={<span>i</span>} variant="outline" />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border-line-default");
  });

  it("applies solid-blue variant classes", () => {
    render(<IconButton icon={<span>i</span>} variant="solid-blue" />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-brand-600");
  });

  it("applies size classes", () => {
    const { rerender } = render(<IconButton icon={<span>i</span>} size="sm" />);
    expect(screen.getByRole("button").className).toContain("w-8");

    rerender(<IconButton icon={<span>i</span>} size="md" />);
    expect(screen.getByRole("button").className).toContain("w-10");

    rerender(<IconButton icon={<span>i</span>} size="lg" />);
    expect(screen.getByRole("button").className).toContain("w-11");
  });

  it("passes additional props to button element", () => {
    render(<IconButton icon={<span>i</span>} aria-label="custom-label" disabled />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-label")).toBe("custom-label");
  });

  it("applies className to the button", () => {
    render(<IconButton icon={<span>i</span>} className="custom-class" />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("custom-class");
  });
});
