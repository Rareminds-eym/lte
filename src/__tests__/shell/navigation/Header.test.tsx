import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/widgets/app/header";

const renderHeader = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Header", () => {
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
