import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MainLayout } from "../app/layouts/MainLayout";
import { useAuthStore } from "../app/store/authStore";

describe("MainLayout", () => {
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
    vi.stubEnv("VITE_SKILLPASSPORT_URL", "http://127.0.0.1:8788");
  });

  it("shows loading state when initializing", () => {
    useAuthStore.setState({ initialized: false, loading: true });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("Authenticating...")).toBeInTheDocument();
  });

  it("shows access required card when entitlement error occurs", () => {
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: false,
      error: "LTE access is required",
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MainLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("LTE Access Required")).toBeInTheDocument();
    expect(screen.getByText("Manage Subscription on SkillPassport")).toBeInTheDocument();
  });
});
