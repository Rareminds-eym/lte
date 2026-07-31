import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthInitializer } from "@/app/providers/AuthInitializer";
import { useAuthStore } from "@/entities/session";

// Mock the active learning path store to isolate auth testing
vi.mock("@/entities/active-learning-path", () => ({
  useLearningPathStore: {
    getState: () => ({
      fetchAndSetActiveLearningPath: vi.fn().mockResolvedValue(undefined),
      clearActiveLearningPath: vi.fn(),
    }),
  },
}));

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
  it("renders loader during silent refresh on startup", () => {
    renderAuthInitializer("/");
    expect(screen.getByTestId("application-loader")).toBeInTheDocument();
    expect(screen.getByText("Initializing application state…")).toBeInTheDocument();
    expect(screen.queryByText(CHILD_CONTENT)).not.toBeInTheDocument();
  });

  it("renders children once initialize completes successfully", async () => {
    const { rerender } = renderAuthInitializer("/");
    expect(screen.getByTestId("application-loader")).toBeInTheDocument();

    useAuthStore.setState({ loading: false, initialized: true, isAuthenticated: true });

    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <AuthInitializer>
          <div>{CHILD_CONTENT}</div>
        </AuthInitializer>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(CHILD_CONTENT)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("application-loader")).not.toBeInTheDocument();
  });

  it("exchanges sso code on callback path", async () => {
    useAuthStore.setState({ loading: false, initialized: false });
    renderAuthInitializer("/auth/callback?code=abc&state=def");

    expect(screen.getByTestId("application-loader")).toBeInTheDocument();
    expect(screen.getByText("Completing sign in…")).toBeInTheDocument();

    await waitFor(() => {
      expect(useAuthStore.getState().exchangeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "abc",
          state: "def",
          redirectUri: expect.stringContaining("/auth/callback"),
        }),
      );
    });
  });

  it("displays callback exchange error status on failure", async () => {
    const exchangeSpy = vi.fn().mockRejectedValue(new Error("SSO failed"));
    useAuthStore.setState({
      loading: false,
      initialized: false,
      exchangeCode: exchangeSpy,
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
