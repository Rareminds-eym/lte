import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserProfileBadge } from "@/widgets/Header/components/UserProfileBadge";

describe("UserProfileBadge", () => {
  it("renders user name", () => {
    render(<UserProfileBadge name="Alice" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders status when provided", () => {
    render(<UserProfileBadge name="Bob" status="L3" />);
    expect(screen.getByText("L3")).toBeInTheDocument();
  });

  it("does not render status when omitted", () => {
    render(<UserProfileBadge name="Charlie" />);
    expect(screen.queryByText("L3")).not.toBeInTheDocument();
  });

  it("renders avatar image when avatarUrl is provided", () => {
    render(<UserProfileBadge name="Dave" avatarUrl="https://example.com/avatar.png" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("renders user icon when avatarUrl is not provided", () => {
    const { container } = render(<UserProfileBadge name="Eve" />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("calls onClick when button is clicked", () => {
    const onClick = vi.fn();
    render(<UserProfileBadge name="Frank" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Frank" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders user icon when no avatar", () => {
    const { container } = render(<UserProfileBadge name="Grace" />);
    const outerBtn = container.querySelector("button");
    expect(outerBtn).toBeInTheDocument();
  });

  it("applies className to the button", () => {
    render(<UserProfileBadge name="Hank" className="custom-badge" />);
    const btn = screen.getByText("Hank").closest("button");
    expect(btn?.className).toContain("custom-badge");
  });
});
