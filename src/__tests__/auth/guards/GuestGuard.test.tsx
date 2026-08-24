import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { GuestGuard } from "@/app/router/guards/GuestGuard";
import { useAuthStore } from "@/entities/session";

beforeEach(() => {
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    loading: false,
    initialized: true,
    error: null,
  });
});

describe("GuestGuard", () => {
  it("renders children when not authenticated", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestGuard>
                <div data-testid="login-page" />
              </GuestGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  it("redirects to /dashboard when authenticated", () => {
    useAuthStore.setState({ isAuthenticated: true });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestGuard>
                <div data-testid="login-page" />
              </GuestGuard>
            }
          />
          <Route path="/dashboard" element={<div data-testid="dashboard-page" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });
});
