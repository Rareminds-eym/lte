import { render, screen } from "@testing-library/react";
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
  Header: ({ userName }: { userName?: string }) => (
    <div data-testid="header" data-user={userName} />
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
    });
    localStorage.removeItem("lte-ui-store");
    useUIStore.setState({ sidebarCollapsed: false });
    vi.stubEnv("VITE_SKILLPASSPORT_URL", "http://127.0.0.1:8788");
  });

  it("shows loading state when initializing", () => {
    useAuthStore.setState({ initialized: false, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

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
});
