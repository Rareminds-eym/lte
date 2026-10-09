import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/widgets/app/header";

vi.mock("@/entities/dashboard", () => ({
  useDashboardData: () => ({
    data: undefined,
    error: null,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const renderHeader = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Header", () => {
  it("submits a trimmed search and keeps the mobile and desktop inputs in sync", () => {
    const submit = vi.fn();
    renderHeader(<Header onSearchSubmit={submit} />);
    const inputs = screen.getAllByLabelText("Search courses, skills, topics");
    const input = inputs[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  API design  " } });
    expect(inputs[1]).toHaveValue("  API design  ");
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(submit).toHaveBeenCalledWith("API design");
  });

  it("supports account menu arrow navigation and Escape returns focus to the trigger", () => {
    renderHeader(<Header userName="Alex" userEmail="alex@example.com" />);
    const trigger = screen.getByRole("button", { name: "Alex, account menu" });
    fireEvent.click(trigger);
    const profile = screen.getByRole("menuitem", { name: "Your Profile" });
    expect(profile).toHaveFocus();
    fireEvent.keyDown(profile, { key: "ArrowDown" });
    const logout = screen.getByRole("menuitem", { name: "Logout" });
    expect(logout).toHaveFocus();
    fireEvent.keyDown(logout, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("opens notifications without scrolling, closes on Escape, and restores focus", () => {
    const scroll = vi.fn();
    const { container } = renderHeader(<Header userName="Alex" userEmail="alex@example.com" />);
    const target = document.createElement("div");
    target.id = "dashboard-feedback";
    target.scrollIntoView = scroll;
    container.append(target);
    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);
    const panel = screen.getByRole("dialog", { name: "Notifications" });
    expect(panel).toHaveFocus();
    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });

  it("keeps account and notification panels mutually exclusive and dismisses outside", () => {
    renderHeader(<Header userName="Alex" userEmail="alex@example.com" />);
    const bell = screen.getByRole("button", { name: "Notifications" });
    const account = screen.getByRole("button", { name: "Alex, account menu" });
    fireEvent.click(bell);
    fireEvent.click(account);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(bell);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bell).toHaveAttribute("aria-expanded", "false");
  });

  it("rejects oversized search input with an accessible validation message", () => {
    const submit = vi.fn();
    renderHeader(<Header onSearchSubmit={submit} />);
    const input = screen.getAllByLabelText("Search courses, skills, topics")[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a".repeat(201) } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(submit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please keep your search under 200 characters.",
    );
  });

  it("renders search input", () => {
    renderHeader(<Header />);
    expect(
      screen.getAllByPlaceholderText("Search courses, skills, topics...")[0],
    ).toBeInTheDocument();
  });

  it("renders notifications button", () => {
    renderHeader(<Header />);
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it('shows "Learner" when no userName provided', () => {
    renderHeader(<Header />);
    expect(screen.getByText("Learner")).toBeInTheDocument();
  });

  it("shows userName when provided", () => {
    renderHeader(<Header userName="John Doe" />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows userStatus when provided", () => {
    renderHeader(<Header userName="John" userStatus="L3" />);
    expect(screen.getByText("L3")).toBeInTheDocument();
  });

  it("calls onSearch when input changes", () => {
    const onSearch = vi.fn();
    renderHeader(<Header onSearch={onSearch} />);
    const [input] = screen.getAllByPlaceholderText("Search courses, skills, topics...");
    if (!input) {
      throw new Error("Expected at least one search input");
    }
    fireEvent.change(input, { target: { value: "react" } });
    expect(onSearch).toHaveBeenCalledWith("react");
  });

  it("applies className to header element", () => {
    const { container } = renderHeader(<Header className="custom-header" />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("custom-header");
  });

  it("shows notification badge when notificationCount is provided", () => {
    renderHeader(<Header notificationCount={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("toggles user profile dropdown and displays email, profile, and logout items", () => {
    const onProfileClick = vi.fn();
    const onLogoutClick = vi.fn();

    renderHeader(
      <Header
        userName="Alex"
        userEmail="alex.johnson@example.com"
        onProfileClick={onProfileClick}
        onLogoutClick={onLogoutClick}
      />,
    );

    // Initial state: dropdown is closed
    expect(screen.queryByText("alex.johnson@example.com")).not.toBeInTheDocument();

    // Click profile badge to open
    const profileBadge = screen.getByRole("button", { name: /alex/i });
    fireEvent.click(profileBadge);

    // Dropdown items visible
    expect(screen.getByText("alex.johnson@example.com")).toBeInTheDocument();
    expect(screen.getByText("Your Profile")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();

    // Click Your Profile
    fireEvent.click(screen.getByText("Your Profile"));
    expect(onProfileClick).toHaveBeenCalledTimes(1);

    // Open again and click Logout
    fireEvent.click(profileBadge);
    fireEvent.click(screen.getByText("Logout"));
    expect(onLogoutClick).toHaveBeenCalledTimes(1);
  });
});
