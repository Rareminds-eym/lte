import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WidgetCard } from "@/shared/ui";

describe("WidgetCard", () => {
  it("renders title and children", () => {
    render(
      <WidgetCard title="Test Widget">
        <div>Widget Content</div>
      </WidgetCard>,
    );

    expect(screen.getByText("Test Widget")).toBeInTheDocument();
    expect(screen.getByText("Widget Content")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <WidgetCard title="Test Title" subtitle="Test Subtitle">
        <div>Content</div>
      </WidgetCard>,
    );

    expect(screen.getByText("Test Subtitle")).toBeInTheDocument();
  });

  it("renders action link when action prop is passed", () => {
    render(
      <WidgetCard title="Test Title" action={{ label: "View all", href: "#all" }}>
        <div>Content</div>
      </WidgetCard>,
    );

    const actionLink = screen.getByRole("link", { name: /view all/i });
    expect(actionLink).toBeInTheDocument();
    expect(actionLink).toHaveAttribute("href", "#all");
  });

  it("renders headerRight when headerRight node is provided", () => {
    render(
      <WidgetCard
        title="Test Title"
        headerRight={<span data-testid="custom-header-right">Custom Header</span>}
      >
        <div>Content</div>
      </WidgetCard>,
    );

    expect(screen.getByTestId("custom-header-right")).toBeInTheDocument();
  });

  it("renders footer when footer prop is provided", () => {
    render(
      <WidgetCard
        title="Test Title"
        footer={<div data-testid="footer-content">Footer Content</div>}
      >
        <div>Content</div>
      </WidgetCard>,
    );

    expect(screen.getByTestId("footer-content")).toBeInTheDocument();
  });
});
