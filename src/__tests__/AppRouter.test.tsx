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

vi.mock("@/pages/course-detail", () => ({
  CourseDetail: () => <div data-testid="course-detail-page" />,
}));

vi.mock("@/app/router/guards/GuestGuard", () => ({
  GuestGuard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="guest-guard">{children}</div>
  ),
}));

import { AppRouter } from "@/app/router/AppRouter";

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

  it("renders 404 for unknown paths", async () => {
    render(
      <MemoryRouter initialEntries={["/unknown"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("not-found-page")).toBeInTheDocument();
  });
});
