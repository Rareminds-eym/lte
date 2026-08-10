import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton, SkeletonGroup } from "@/shared/ui/skeleton";

describe("Skeleton", () => {
  it("renders with aria-hidden='true' by default", () => {
    const { container } = render(<Skeleton className="h-4 w-12" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).not.toHaveAttribute("role");
  });

  it("applies custom className", () => {
    const { container } = render(<Skeleton className="h-10 w-20" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("w-20");
    expect(el.className).toContain("bg-surface-muted");
  });
});

describe("SkeletonGroup", () => {
  it("renders children inside an animate-pulse container", () => {
    const { container } = render(
      <SkeletonGroup>
        <Skeleton className="h-4 w-full" />
      </SkeletonGroup>,
    );
    const group = container.firstChild as HTMLElement;
    expect(group.className).toContain("animate-pulse");
  });

  it("renders as role='status' and announces via sr-only text when aria-label is provided", () => {
    const { container } = render(
      <SkeletonGroup aria-label="Loading dashboard analytics">
        <Skeleton />
      </SkeletonGroup>,
    );
    const group = container.firstChild as HTMLElement;
    expect(group).toHaveAttribute("role", "status");
    expect(group).toHaveAttribute("aria-live", "polite");
    expect(group).toHaveAttribute("aria-busy", "true");

    const srText = screen.getByText("Loading dashboard analytics");
    expect(srText).toBeInTheDocument();
    expect(srText.className).toContain("sr-only");
  });

  it("does not act as an aria status region when no aria-label is provided", () => {
    const { container } = render(
      <SkeletonGroup>
        <Skeleton />
      </SkeletonGroup>,
    );
    const group = container.firstChild as HTMLElement;
    expect(group).not.toHaveAttribute("role");
    expect(group).not.toHaveAttribute("aria-live");
    expect(group).not.toHaveAttribute("aria-busy");
  });
});
