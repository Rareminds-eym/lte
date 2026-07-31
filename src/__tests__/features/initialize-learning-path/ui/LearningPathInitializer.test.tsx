import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/entities/session";
import { initializeLearningPathSchema } from "@/features/initialize-learning-path/model/initializeLearningPath.schema";
import { useInitializeLearningPath } from "@/features/initialize-learning-path/model/useInitializeLearningPath";
import { LearningPathInitializer } from "@/features/initialize-learning-path/ui/LearningPathInitializer";

type StoreState = ReturnType<typeof useAuthStore.getState>;

// Mock auth store
vi.mock("@/entities/session", () => ({
  useAuthStore: vi.fn(),
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

    // Default mock implementation for useAuthStore selector calls
    vi.mocked(useAuthStore).mockImplementation(<T,>(selector?: (s: StoreState) => T) => {
      const state: StoreState = {
        accessToken: "mock-token",
        loading: false,
        initialized: true,
        isAuthenticated: true,
        user: null,
        error: null,
        initialize: vi.fn(),
        exchangeCode: vi.fn(),
        logout: vi.fn(),
        setAccessToken: vi.fn(),
      };
      return selector ? selector(state) : (state as T);
    });

    // Default mock implementation for useInitializeLearningPath
    vi.mocked(useInitializeLearningPath).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useInitializeLearningPath>);
  });

  describe("initializeLearningPathSchema (Validation)", () => {
    it("validates correct payloads", () => {
      const payload = {
        fit: "High",
        track: "Frontend",
        matchScore: "85",
        whyItFits: "Good match",
        attemptId: "777b7ccb-ca18-4770-bc2f-6893608cc738",
        roleId: "888b7ccb-ca18-4770-bc2f-6893608cc739",
      };

      const result = initializeLearningPathSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matchScore).toBe(85);
      }
    });

    it("fails on invalid match score range", () => {
      const payload = {
        fit: "High",
        track: "Frontend",
        matchScore: "150",
        whyItFits: "Too high",
        attemptId: "777b7ccb-ca18-4770-bc2f-6893608cc738",
        roleId: "888b7ccb-ca18-4770-bc2f-6893608cc739",
      };

      const result = initializeLearningPathSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("fails on non-UUID attemptId/roleId", () => {
      const payload = {
        fit: "High",
        track: "Frontend",
        matchScore: "85",
        whyItFits: "Invalid UUIDs",
        attemptId: "not-a-uuid",
        roleId: "not-a-uuid",
      };

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
      renderInitializer(
        "fit=High&track=Frontend&matchScore=invalid_score&attemptId=not-uuid&roleId=not-uuid",
      );

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
      vi.mocked(useInitializeLearningPath).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      } as unknown as ReturnType<typeof useInitializeLearningPath>);

      const params = [
        "fit=High",
        "track=Frontend",
        "matchScore=92",
        "attemptId=777b7ccb-ca18-4770-bc2f-6893608cc738",
        "roleId=888b7ccb-ca18-4770-bc2f-6893608cc739",
      ].join("&");

      renderInitializer(params);

      expect(screen.getByText("Initializing learning path...")).toBeInTheDocument();
      expect(mockMutate).toHaveBeenCalledWith(
        {
          payload: {
            fit: "High",
            track: "Frontend",
            matchScore: 92,
            whyItFits: "",
            attemptId: "777b7ccb-ca18-4770-bc2f-6893608cc738",
            roleId: "888b7ccb-ca18-4770-bc2f-6893608cc739",
            duration: "6 months",
          },
        },
        expect.any(Object),
      );
    });
  });
});
