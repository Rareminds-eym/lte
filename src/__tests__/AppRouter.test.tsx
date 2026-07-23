import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";
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

vi.mock("@/pages/Courses", () => ({
  Courses: () => <div data-testid="courses-page" />,
}));

vi.mock("@/pages/Dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-page" />,
}));

vi.mock("@/pages/HomePage", () => ({
  HomePage: () => <div data-testid="home-page" />,
}));

vi.mock("@/pages/LoginPage", () => ({
  LoginPage: () => <div data-testid="login-page" />,
}));

vi.mock("@/pages/NotFound", () => ({
  NotFound: () => <div data-testid="not-found-page" />,
}));

vi.mock("@/app/router/guards/GuestGuard", () => ({
  GuestGuard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="guest-guard">{children}</div>
  ),
}));

import { AppRouter } from "@/app/router/AppRouter";

describe("AppRouter", () => {
  it("renders home page at /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });

  it("renders login page at /login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("guest-guard")).toBeInTheDocument();
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  it("renders dashboard at /dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("renders courses at /my-courses", () => {
    render(
      <MemoryRouter initialEntries={["/my-courses"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(screen.getByTestId("courses-page")).toBeInTheDocument();
  });

  it("renders 404 for unknown paths", () => {
    render(
      <MemoryRouter initialEntries={["/unknown"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("not-found-page")).toBeInTheDocument();
  });
});
