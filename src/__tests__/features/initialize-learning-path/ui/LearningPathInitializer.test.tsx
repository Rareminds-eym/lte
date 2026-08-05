import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initializeLearningPathSchema } from "@/features/initialize-learning-path/model/initializeLearningPath.schema";
import { useInitializeLearningPath } from "@/features/initialize-learning-path/model/useInitializeLearningPath";
import { LearningPathInitializer } from "@/features/initialize-learning-path/ui/LearningPathInitializer";

type StoreState = {
  accessToken: string | null;
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  user: { id: string } | null;
  error: Error | null;
  initialize: () => void;
  exchangeCode: () => void;
  logout: () => void;
  setAccessToken: () => void;
};

type AuthStoreMock = Mock<(selector?: (s: StoreState) => unknown) => unknown> & {
  getState: ReturnType<typeof vi.fn>;
};

// Mock auth store
const mockUseAuthStore = vi.hoisted(() => vi.fn() as unknown as AuthStoreMock);
vi.mock("@/entities/session", () => ({
  useAuthStore: mockUseAuthStore,
}));

// Mock learning path store
vi.mock("@/entities/active-learning-path", () => ({
  useLearningPathStore: {
    getState: () => ({
      fetchAndSetActiveLearningPath: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock useInitializeLearningPath hook
vi.mock("@/features/initialize-learning-path/model/useInitializeLearningPath", () => ({
  useInitializeLearningPath: vi.fn(),
}));

const mockNavigate = vi.fn();

// Mock react-router-dom's navigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("LearningPathInitializer Feature", () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const mockState: StoreState = {
      accessToken: "mock-token",
      loading: false,
      initialized: true,
      isAuthenticated: true,
      user: { id: "user-123" },
      error: null,
      initialize: vi.fn(),
      exchangeCode: vi.fn(),
      logout: vi.fn(),
      setAccessToken: vi.fn(),
    };

    mockUseAuthStore.mockImplementation((selector?: (s: StoreState) => unknown) => {
      return selector ? selector(mockState) : mockState;
    });

    mockUseAuthStore.getState = vi.fn().mockReturnValue(mockState);

    // Default mock implementation for useInitializeLearningPath
    (useInitializeLearningPath as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  describe("initializeLearningPathSchema (Validation)", () => {
    it("validates correct payloads", () => {
      const payload = {
        trackId: "11111111-1111-4111-a111-111111111111",
      };

      const result = initializeLearningPathSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trackId).toBe("11111111-1111-4111-a111-111111111111");
      }
    });

    it("fails on non-UUID trackId", () => {
      const payload = {
        trackId: "not-a-uuid",
      };

      const result = initializeLearningPathSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("fails when trackId is missing", () => {
      const payload = {};

      const result = initializeLearningPathSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("LearningPathInitializer Component", () => {
    const renderInitializer = (searchParamsString: string) => {
      return render(
        <MemoryRouter initialEntries={[`/my-courses/CAP-101?${searchParamsString}`]}>
          <LearningPathInitializer capabilityCode="CAP-101" />
        </MemoryRouter>,
      );
    };

    it("does nothing and returns null if no query parameters exist", () => {
      const { container } = renderInitializer("");
      expect(container.firstChild).toBeNull();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it("redirects with validation error when query parameters are invalid", async () => {
      renderInitializer("trackId=invalid-uuid");

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/my-courses/CAP-101",
          expect.objectContaining({
            replace: true,
            state: expect.objectContaining({
              initializationError: expect.any(String),
            }),
          }),
        );
      });
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it("triggers mutation and shows page loader when query params are valid", async () => {
      (useInitializeLearningPath as Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      const params = "trackId=777b7ccb-ca18-4770-bc2f-6893608cc738";

      renderInitializer(params);

      expect(screen.getByText("Activating learning track...")).toBeInTheDocument();
      expect(mockMutate).toHaveBeenCalledWith(
        {
          payload: {
            trackId: "777b7ccb-ca18-4770-bc2f-6893608cc738",
          },
        },
        expect.any(Object),
      );
    });

    it("redirects to /my-courses on success when capabilityCode is not provided", async () => {
      (useInitializeLearningPath as Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      const params = "trackId=777b7ccb-ca18-4770-bc2f-6893608cc738";

      render(
        <MemoryRouter initialEntries={[`/my-courses?${params}`]}>
          <LearningPathInitializer />
        </MemoryRouter>,
      );

      expect(mockMutate).toHaveBeenCalled();
      const callbackObj = mockMutate.mock.calls[0]?.[1];
      expect(callbackObj).toBeDefined();

      if (callbackObj && typeof callbackObj.onSuccess === "function") {
        await callbackObj.onSuccess();
        expect(mockNavigate).toHaveBeenCalledWith("/my-courses", { replace: true });
      }
    });
  });
});
