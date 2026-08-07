import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { useAuthStore } from "@/entities/session";
import { useUIStore } from "@/shared/store/uiStore";

vi.mock("@/widgets/app/NavigationDrawer", () => ({
  NavigationDrawer: ({
    activeNavId,
    onNavigate,
  }: {
    activeNavId?: string;
    onNavigate?: (id: string) => void;
  }) => (
    <div data-testid="nav-drawer" data-active={activeNavId}>
      <button onClick={() => onNavigate?.("settings")} type="button">
        Nav
      </button>
    </div>
  ),
}));

vi.mock("@/widgets/app/Header", () => ({
  Header: ({
    userName,
    userEmail,
    onLogoutClick,
  }: {
    userName?: string;
    userEmail?: string;
    onLogoutClick?: () => void;
  }) => (
    <button
      data-testid="header"
      data-user={userName}
      data-email={userEmail}
      onClick={onLogoutClick}
      type="button"
    />
  ),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      initialized: true,
      loading: false,
      error: null,
      initialize: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
    });
    localStorage.removeItem("lte-ui-store");
    useUIStore.setState({ sidebarCollapsed: false });
    vi.stubEnv("VITE_SKILLPASSPORT_URL", "http://127.0.0.1:8788");
  });

  /**
   * Loading state skeleton is no longer rendered by DashboardLayout.
   * It is now handled by AuthInitializer (app/providers/AuthInitializer)
   * which shows ApplicationLoader before any route/layout renders.
   * See AuthInitializer.test.tsx for bootstrap loading tests.
   */
  it.skip("loading state is handled by AuthInitializer, not DashboardLayout", () => {});

  it("shows access required card when entitlement error occurs", () => {
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: false,
      error: "LTE access is required",
    });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText("LTE Access Required")).toBeInTheDocument();
    expect(screen.getByText("Manage Subscription on SkillPassport")).toBeInTheDocument();
  });

  it("shows access denied card for denied error", () => {
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: false,
      error: "Access denied",
    });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText("LTE Access Required")).toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", () => {
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: false,
      error: null,
    });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    const loginLinks = screen.queryAllByRole("link");
    expect(loginLinks.length).toBe(0);
  });

  it("renders navigation drawer and header when authenticated", () => {
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: true,
      user: {
        id: "u1",
        email: "test@example.com",
        org_id: "org-1",
        roles: ["learner"],
        products: ["lte"],
        membership_status: "active",
        is_email_verified: true,
        user_metadata: { full_name: "Test User" },
      },
      error: null,
    });
    render(
      <MemoryRouter initialEntries={["/my-courses"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("nav-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("extracts name from email when no full_name", () => {
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: true,
      user: {
        id: "u2",
        email: "jane@example.com",
        org_id: "org-1",
        roles: ["learner"],
        products: ["lte"],
        membership_status: "active",
        is_email_verified: true,
        user_metadata: {},
      },
      error: null,
    });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("header")).toHaveAttribute("data-user", "jane");
  });

  it("uses name from user_metadata.name when no full_name", () => {
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: true,
      user: {
        id: "u3",
        email: "bob@example.com",
        org_id: "org-1",
        roles: ["learner"],
        products: ["lte"],
        membership_status: "active",
        is_email_verified: true,
        user_metadata: { name: "Bob" },
      },
      error: null,
    });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("header")).toHaveAttribute("data-user", "Bob");
  });

  it("passes userEmail and calls logout when logout is triggered", async () => {
    const logoutSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: true,
      user: {
        id: "u4",
        email: "logout-test@example.com",
        org_id: "org-1",
        roles: ["learner"],
        products: ["lte"],
        membership_status: "active",
        is_email_verified: true,
        user_metadata: { full_name: "Logout Test User" },
      },
      error: null,
      logout: logoutSpy,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );

    const header = screen.getByTestId("header");
    expect(header).toHaveAttribute("data-email", "logout-test@example.com");

    // Trigger logout handler
    header.click();
    await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1));
  });
});
