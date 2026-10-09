import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/layouts/DashboardLayout", () => ({
  DashboardLayout: () => (
    <div data-testid="dashboard-layout">
      <Outlet />
    </div>
  ),
}));

vi.mock("@/app/layouts/MainLayout", () => ({
  MainLayout: () => (
    <div data-testid="main-layout">
      <Outlet />
    </div>
  ),
}));

vi.mock("@/app/layouts/LevelPlayerLayout", () => ({
  LevelPlayerLayout: () => (
    <div data-testid="level-player-layout">
      <Outlet />
    </div>
  ),
}));

vi.mock("@/pages/courses", () => ({
  Courses: () => <div data-testid="courses-page" />,
}));

vi.mock("@/pages/certificates", () => ({
  CertificatesPage: () => {
    const [params] = useSearchParams();
    return <div data-testid="certificates-page">{params.get("levelId")}</div>;
  },
}));

vi.mock("@/pages/dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-page" />,
}));

vi.mock("@/pages/home", () => ({
  HomePage: () => <div data-testid="home-page" />,
}));

vi.mock("@/pages/login", () => ({
  LoginPage: () => <div data-testid="login-page" />,
}));

vi.mock("@/pages/not-found", () => ({
  NotFound: () => <div data-testid="not-found-page" />,
}));

vi.mock("@/pages/course-detail", () => ({
  CourseDetail: () => <div data-testid="course-detail-page" />,
}));

vi.mock("@/pages/level-content", () => ({
  LevelContent: () => <div data-testid="level-content-page" />,
}));

vi.mock("@/app/router/guards/GuestGuard", () => ({
  GuestGuard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="guest-guard">{children}</div>
  ),
}));

import { AppRouter } from "@/app/router/AppRouter";

function HistoryControls() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Back
    </button>
  );
}

describe("AppRouter", () => {
  it("renders home page at /", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("main-layout")).toBeInTheDocument();
    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
  });

  it("renders login page at /login", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("guest-guard")).toBeInTheDocument();
    expect(await screen.findByTestId("login-page")).toBeInTheDocument();
  });

  it("renders dashboard at /dashboard", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("dashboard-layout")).toBeInTheDocument();
    expect(await screen.findByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("renders courses at /my-courses", async () => {
    render(
      <MemoryRouter initialEntries={["/my-courses"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("dashboard-layout")).toBeInTheDocument();
    expect(await screen.findByTestId("courses-page")).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "My Learning" });
    expect(within(navigation).getByRole("link", { name: "Courses" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("switches learning destinations and restores the selected tab on browser back", async () => {
    render(
      <MemoryRouter initialEntries={["/my-courses?q=security"]}>
        <HistoryControls />
        <AppRouter />
      </MemoryRouter>,
    );
    await screen.findByTestId("courses-page");
    const navigation = screen.getByRole("navigation", { name: "My Learning" });
    fireEvent.click(within(navigation).getByRole("link", { name: "Certificates" }));
    expect(await screen.findByTestId("certificates-page")).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "Certificates" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(navigation).getByRole("link", { name: "Courses" })).not.toHaveAttribute(
      "aria-current",
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByTestId("courses-page")).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "Courses" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each([
    "/certificates",
    "/certificates?levelId=0a010796-10c0-5287-b89a-6ab56bd71399",
  ])("keeps certificate deep links inside My Learning: %s", async (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>,
    );
    const page = await screen.findByTestId("certificates-page");
    if (path.includes("levelId=")) {
      expect(page).toHaveTextContent("0a010796-10c0-5287-b89a-6ab56bd71399");
    }
    const navigation = screen.getByRole("navigation", { name: "My Learning" });
    expect(within(navigation).getByRole("link", { name: "Certificates" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    fireEvent.click(within(navigation).getByRole("link", { name: "Courses" }));
    expect(await screen.findByTestId("courses-page")).toBeInTheDocument();
  });

  it("renders course detail at /my-courses/:capabilityCode", async () => {
    render(
      <MemoryRouter initialEntries={["/my-courses/SEC-OPS-01"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("dashboard-layout")).toBeInTheDocument();
    expect(await screen.findByTestId("course-detail-page")).toBeInTheDocument();
  });

  it("renders level content at /my-courses/:levelId/modules/:moduleNo", async () => {
    render(
      <MemoryRouter initialEntries={["/my-courses/0a010796-10c0-5287-b89a-6ab56bd71399/modules/1"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("level-player-layout")).toBeInTheDocument();
    expect(await screen.findByTestId("level-content-page")).toBeInTheDocument();
  });

  it("renders 404 for unknown paths", async () => {
    render(
      <MemoryRouter initialEntries={["/unknown"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("not-found-page")).toBeInTheDocument();
  });
});
