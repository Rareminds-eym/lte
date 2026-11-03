import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WidgetCard } from "@/shared/ui";

describe("WidgetCard", () => {
  it("renders an operable action button and a dismissible accessible tooltip", () => {
    const action = vi.fn();
    render(
      <WidgetCard
        title="Capabilities"
        infoTooltip="Compare current and target levels"
        action={{ label: "View map", onClick: action }}
      >
        Content
      </WidgetCard>,
    );
    fireEvent.click(screen.getByRole("button", { name: "View map" }));
    expect(action).toHaveBeenCalledOnce();
    const info = screen.getByRole("button", { name: "About Capabilities" });
    const tooltip = screen.getByRole("tooltip");
    expect(info).toHaveAttribute("aria-describedby", tooltip.id);
    fireEvent.focus(info);
    fireEvent.keyDown(info, { key: "Escape" });
    expect(tooltip).not.toHaveClass("group-focus-within/tooltip:visible");
  });

  it("makes bounded overflowing content keyboard accessible without losing actions", () => {
    const action = vi.fn();
    render(
      <WidgetCard
        title="Bounded card"
        scrollable
        className="min-h-80 max-h-[30rem]"
        action={{ label: "Open details", onClick: action }}
        footer={<button type="button">Footer action</button>}
      >
        Long content
      </WidgetCard>,
    );
    const region = screen.getByRole("region", { name: "Bounded card content" });
    region.focus();
    expect(region).toHaveFocus();
    expect(region).toHaveTextContent("Long content");
    expect(region).not.toContainElement(screen.getByRole("heading", { name: "Bounded card" }));
    expect(region).not.toContainElement(screen.getByRole("button", { name: "Open details" }));
    expect(screen.getByRole("button", { name: "Footer action" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(action).toHaveBeenCalledOnce();
  });

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
