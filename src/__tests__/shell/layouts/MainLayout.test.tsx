import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MainLayout } from "@/app/layouts/MainLayout";
import { useAuthStore } from "@/entities/session";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  useAuthStore.setState({
    accessToken: null,
    user: null,
    isAuthenticated: false,
    loading: true,
    initialized: false,
    error: null,
    initialize: vi.fn().mockResolvedValue(undefined),
    exchangeCode: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    setAccessToken: vi.fn(),
  });
  mockNavigate.mockClear();
  window.history.replaceState({}, "", "/");
});

describe("MainLayout", () => {
  it("calls initialize on mount when not authenticated", () => {
    const initializeSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      initialized: false,
      isAuthenticated: false,
      initialize: initializeSpy,
    });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MainLayout />
      </MemoryRouter>,
    );
    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });

  it("does not call initialize when already authenticated", () => {
    const initializeSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      initialized: true,
      isAuthenticated: true,
      initialize: initializeSpy,
    });
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MainLayout />
      </MemoryRouter>,
    );
    expect(initializeSpy).not.toHaveBeenCalled();
  });

  it("does not call initialize during callback exchange phase", () => {
    const initializeSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      initialized: false,
      isAuthenticated: false,
      initialize: initializeSpy,
      exchangeCode: vi.fn(() => new Promise<void>(() => {})),
    });
    render(
      <MemoryRouter initialEntries={["/auth/callback?code=abc&state=def"]}>
        <MainLayout />
      </MemoryRouter>,
    );
    expect(screen.getByText("Signing you in")).toBeInTheDocument();
    expect(initializeSpy).not.toHaveBeenCalled();
  });

  it("navigates to /dashboard after successful exchange", async () => {
    useAuthStore.setState({
      exchangeCode: vi.fn().mockResolvedValue(undefined),
    });
    render(
      <MemoryRouter initialEntries={["/auth/callback?code=abc&state=def"]}>
        <MainLayout />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("navigates to custom next parameter URL after successful exchange", async () => {
    const exchangeCodeSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      exchangeCode: exchangeCodeSpy,
    });
    render(
      <MemoryRouter
        initialEntries={["/auth/callback?code=abc&state=def&next=%2Fmy-courses%2FSEC-OPS-01"]}
      >
        <MainLayout />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/my-courses/SEC-OPS-01", { replace: true });
    });
    expect(exchangeCodeSpy).toHaveBeenCalledWith({
      code: "abc",
      state: "def",
      redirectUri: `${window.location.origin}/auth/callback`,
      targetNext: "/my-courses/SEC-OPS-01",
    });
  });

  it("rejects dot-prefixed protocol-relative next values", async () => {
    useAuthStore.setState({
      exchangeCode: vi.fn().mockResolvedValue(undefined),
    });
    render(
      <MemoryRouter initialEntries={["/auth/callback?code=abc&state=def&next=.//example.com"]}>
        <MainLayout />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("shows error screen when exchange fails", async () => {
    useAuthStore.setState({
      exchangeCode: vi.fn().mockRejectedValue(new Error("SSO failed")),
    });
    render(
      <MemoryRouter initialEntries={["/auth/callback?code=abc&state=def"]}>
        <MainLayout />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("Unable to sign in")).toBeInTheDocument();
    });
  });

  it("renders outlet when not on callback path", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <MainLayout />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Signing you in")).not.toBeInTheDocument();
  });

  it("redirects to / when /auth/callback has no parameters", () => {
    render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <Routes>
          <Route path="/" element={<div data-testid="home" />} />
          <Route path="/auth/callback" element={<MainLayout />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });
});
