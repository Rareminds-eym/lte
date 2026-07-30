import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthInitializer } from "@/app/providers/AuthInitializer";
import { useAuthStore } from "@/entities/session";

// Mock the shared Image component used by ApplicationLoader
vi.mock("@/shared/ui/Image", () => ({
  Image: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const CHILD_CONTENT = "App content";

function renderAuthInitializer(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthInitializer>
        <div>{CHILD_CONTENT}</div>
      </AuthInitializer>
    </MemoryRouter>,
  );
}

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

describe("AuthInitializer", () => {
  it("shows ApplicationLoader when loading=true and initialized=false", () => {
    useAuthStore.setState({ loading: true, initialized: false });
    renderAuthInitializer("/");
    expect(screen.getByTestId("application-loader")).toBeInTheDocument();
    expect(screen.queryByText(CHILD_CONTENT)).not.toBeInTheDocument();
  });

  it("renders children once auth is initialized", () => {
    useAuthStore.setState({ loading: false, initialized: true });
    renderAuthInitializer("/");
    expect(screen.getByText(CHILD_CONTENT)).toBeInTheDocument();
    expect(screen.queryByTestId("application-loader")).not.toBeInTheDocument();
  });

  it("calls initialize on mount when not authenticated and not initialized", () => {
    const initializeSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      loading: false,
      initialized: false,
      isAuthenticated: false,
      initialize: initializeSpy,
    });
    renderAuthInitializer("/dashboard");
    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });

  it("does not call initialize when already authenticated and initialized", () => {
    const initializeSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      loading: false,
      initialized: true,
      isAuthenticated: true,
      initialize: initializeSpy,
    });
    renderAuthInitializer("/dashboard");
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
    renderAuthInitializer("/auth/callback?code=abc&state=def");
    expect(screen.getByTestId("application-loader")).toBeInTheDocument();
    expect(initializeSpy).not.toHaveBeenCalled();
  });

  it("navigates to /dashboard after a successful SSO code exchange", async () => {
    useAuthStore.setState({
      exchangeCode: vi.fn().mockResolvedValue(undefined),
    });
    renderAuthInitializer("/auth/callback?code=abc&state=def");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("navigates to custom `next` param URL after a successful exchange", async () => {
    const exchangeCodeSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ exchangeCode: exchangeCodeSpy });
    renderAuthInitializer("/auth/callback?code=abc&state=def&next=%2Fmy-courses%2FSEC-OPS-01");
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

  it("rejects protocol-relative next values and falls back to /dashboard", async () => {
    useAuthStore.setState({
      exchangeCode: vi.fn().mockResolvedValue(undefined),
    });
    renderAuthInitializer("/auth/callback?code=abc&state=def&next=.//example.com");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("shows an error message and action buttons when SSO exchange fails", async () => {
    useAuthStore.setState({
      exchangeCode: vi.fn().mockRejectedValue(new Error("SSO failed")),
    });
    renderAuthInitializer("/auth/callback?code=abc&state=def");
    await waitFor(() => {
      expect(screen.getByText("Unable to sign in")).toBeInTheDocument();
    });
    expect(screen.getByText("SSO failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return to login/i })).toBeInTheDocument();
  });

  it("redirects to landing page when bare /auth/callback is visited without parameters", () => {
    useAuthStore.setState({ loading: false, initialized: true });
    render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <Routes>
          <Route
            path="/auth/callback"
            element={
              <AuthInitializer>
                <div>{CHILD_CONTENT}</div>
              </AuthInitializer>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
