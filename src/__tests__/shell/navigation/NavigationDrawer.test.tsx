import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationDrawer } from "@/widgets/app/NavigationDrawer";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("react-hot-toast", () => ({ default: toastMock }));

const LOCKED_LABELS = [
  "Rewards & Milestones",
  "Career Explorer",
  "Learning Progress",
  "Mentor Feedback",
  "Achievements",
  "Settings",
];

describe("NavigationDrawer", () => {
  beforeEach(() => {
    toastMock.mockClear();
  });

  it("renders all 8 nav items", () => {
    render(<NavigationDrawer />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("My Courses")).toBeInTheDocument();
    expect(screen.getByText("Rewards & Milestones")).toBeInTheDocument();
    expect(screen.getByText("Career Explorer")).toBeInTheDocument();
    expect(screen.getByText("Learning Progress")).toBeInTheDocument();
    expect(screen.getByText("Mentor Feedback")).toBeInTheDocument();
    expect(screen.getByText("Achievements")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("defaults activeNavId to dashboard", () => {
    render(<NavigationDrawer />);
    const dashboardBtn = screen.getByText("Dashboard").closest("button");
    expect(dashboardBtn?.className).toContain("bg-brand-50");
  });

  it("accepts a different activeNavId", () => {
    render(<NavigationDrawer activeNavId="my-courses" />);
    const coursesBtn = screen.getByText("My Courses").closest("button");
    expect(coursesBtn?.className).toContain("bg-brand-50");
  });

  it("calls onNavigate when an unlocked nav item is clicked", () => {
    const onNavigate = vi.fn();
    render(<NavigationDrawer onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("My Courses"));
    expect(onNavigate).toHaveBeenCalledWith("my-courses");
  });

  it("applies collapsed width class when isCollapsed is true", () => {
    const { container } = render(<NavigationDrawer isCollapsed />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("w-[72px]");
    expect(aside?.className).not.toContain("w-64");
  });

  it("applies expanded width class when isCollapsed is false", () => {
    const { container } = render(<NavigationDrawer isCollapsed={false} />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("w-64");
  });

  it("calls onToggleCollapse when toggle button is clicked", () => {
    const onToggleCollapse = vi.fn();
    render(<NavigationDrawer onToggleCollapse={onToggleCollapse} />);
    const toggleBtn = screen.getByLabelText("Collapse sidebar");
    fireEvent.click(toggleBtn);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it("shows expand label when collapsed", () => {
    render(<NavigationDrawer isCollapsed onToggleCollapse={vi.fn()} />);
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("shows title attribute on nav items when collapsed", () => {
    render(<NavigationDrawer isCollapsed />);
    const items = screen.getAllByRole("button");
    const navBtn = items.find((b) => b.getAttribute("title") === "Dashboard");
    expect(navBtn).toBeTruthy();
  });

  it("renders AI Mentor promo card when expanded", () => {
    render(<NavigationDrawer isCollapsed={false} />);
    expect(screen.getByText("Need help choosing what to do next?")).toBeInTheDocument();
    expect(screen.getByText("Ask AI Mentor")).toBeInTheDocument();
  });

  it("renders AI Mentor icon button when collapsed", () => {
    render(<NavigationDrawer isCollapsed />);
    expect(screen.getByLabelText("Ask AI Mentor — Coming soon")).toBeInTheDocument();
  });

  it("applies className to aside element", () => {
    const { container } = render(<NavigationDrawer className="custom-class" />);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("custom-class");
  });

  it("handles nav click when onNavigate is not provided", () => {
    render(<NavigationDrawer />);
    const dashboardBtn = screen.getByText("Dashboard").closest("button");
    expect(dashboardBtn?.className).toContain("bg-brand-50");
    fireEvent.click(screen.getByText("My Courses"));
    const coursesBtn = screen.getByText("My Courses").closest("button");
    expect(coursesBtn?.className).toContain("bg-brand-50");
  });

  it.each(LOCKED_LABELS)("marks %s as disabled and locked", (label) => {
    const { container } = render(<NavigationDrawer />);
    const btn = screen.getByText(label).closest("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn).toHaveAttribute("title", "Coming soon");
    expect(btn?.querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll("nav [aria-disabled='true']").length).toBe(
      LOCKED_LABELS.length,
    );
  });

  it("keeps the label in the title tooltip for locked items when collapsed", () => {
    render(<NavigationDrawer isCollapsed />);
    const btn = screen.getByText("Settings").closest("button");
    expect(btn).toHaveAttribute("title", "Settings — Coming soon");
  });

  it("does not call onNavigate or change active item when a locked item is clicked", () => {
    const onNavigate = vi.fn();
    render(<NavigationDrawer onNavigate={onNavigate} />);
    const dashboardBtn = screen.getByText("Dashboard").closest("button");
    expect(dashboardBtn?.className).toContain("bg-brand-50");

    fireEvent.click(screen.getByText("Settings"));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(dashboardBtn?.className).toContain("bg-brand-50");
    expect(screen.getByText("Settings").closest("button")?.className).not.toContain("bg-brand-50");
  });

  it.each(LOCKED_LABELS)("shows a coming soon toast when %s is clicked", (label) => {
    render(<NavigationDrawer />);
    fireEvent.click(screen.getByText(label));
    expect(toastMock).toHaveBeenCalledWith(`${label} is coming soon`, expect.any(Object));
  });

  it("does not show a toast when an unlocked item is clicked", () => {
    render(<NavigationDrawer />);
    fireEvent.click(screen.getByText("My Courses"));
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("shows a coming soon toast when Ask AI Mentor button is clicked", () => {
    render(<NavigationDrawer isCollapsed={false} />);
    fireEvent.click(screen.getByText("Ask AI Mentor"));
    expect(toastMock).toHaveBeenCalledWith("AI Mentor is coming soon", expect.any(Object));
  });

  it("shows a coming soon toast when collapsed AI Mentor icon is clicked", () => {
    render(<NavigationDrawer isCollapsed />);
    fireEvent.click(screen.getByLabelText("Ask AI Mentor — Coming soon"));
    expect(toastMock).toHaveBeenCalledWith("AI Mentor is coming soon", expect.any(Object));
  });

  it("keeps locked items focusable for discoverability", () => {
    render(<NavigationDrawer />);
    const btn = screen.getByText("Settings").closest("button");
    expect(btn).not.toBeDisabled();
    btn?.focus();
    expect(btn).toHaveFocus();
  });
});
