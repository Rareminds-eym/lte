import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationDrawer } from "@/widgets/app/NavigationDrawer";

describe("NavigationDrawer", () => {
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

  it("calls onNavigate when a nav item is clicked", () => {
    const onNavigate = vi.fn();
    render(<NavigationDrawer onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Settings"));
    expect(onNavigate).toHaveBeenCalledWith("settings");
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
    expect(screen.getByLabelText("Ask AI Mentor")).toBeInTheDocument();
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
});
