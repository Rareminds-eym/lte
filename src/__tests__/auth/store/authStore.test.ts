import type {
  CurrentSessionLogoutResult,
  IdentityDTO,
  SessionOutcome,
  WorkflowOutcome,
} from "@rareminds-eym/auth-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/entities/session";
import { authClient } from "@/shared/api/authClient";
import type { AuthUser } from "@/shared/types/auth";

vi.mock("@/shared/api/authClient", () => ({
  authClient: {
    initialize: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  },
}));

const mockAuthUser: AuthUser = {
  id: "user-1",
  email: "test@example.com",
  org_id: "org-1",
  roles: ["learner"],
  products: ["lte"],
  membership_status: "active",
  is_email_verified: true,
  user_metadata: { full_name: "Test User" },
};

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    loading: true,
    initialized: false,
    error: null,
    initialize: useAuthStore.getState().initialize,
    exchangeCode: useAuthStore.getState().exchangeCode,
    logout: useAuthStore.getState().logout,
  });
  vi.clearAllMocks();
});

describe("authStore", () => {
  describe("initialize", () => {
    it("skips if already authenticated and initialized", async () => {
      useAuthStore.setState({ isAuthenticated: true, initialized: true });
      await useAuthStore.getState().initialize();
      expect(authClient.initialize).not.toHaveBeenCalled();
    });

    it("restores session on success", async () => {
      vi.mocked(authClient.initialize).mockResolvedValueOnce({
        status: "authenticated",
      } as unknown as SessionOutcome);
      vi.mocked(authClient.getMe).mockResolvedValueOnce({
        status: "succeeded",
        data: {
          subject: "user-1",
          email: "test@example.com",
          organizationId: "org-1",
          roles: ["learner"],
          products: ["lte"],
          membershipStatus: "active",
          emailVerified: true,
          userMetadata: { full_name: "Test User" },
        },
      } as unknown as WorkflowOutcome<IdentityDTO>);

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toEqual(mockAuthUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().initialized).toBe(true);
    });

    it("handles session failure gracefully", async () => {
      vi.mocked(authClient.initialize).mockRejectedValueOnce(new Error("Network error"));

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().error).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().initialized).toBe(true);
    });
  });

  describe("exchangeCode", () => {
    const exchangeParams = {
      code: "abc123",
      state: "state123",
      redirectUri: "http://localhost/auth/callback",
    };

    it("exchanges code and sets authenticated state", async () => {
      vi.mocked(authClient.initialize).mockResolvedValueOnce({
        status: "authenticated",
      } as unknown as SessionOutcome);
      vi.mocked(authClient.getMe).mockResolvedValueOnce({
        status: "succeeded",
        data: {
          subject: "user-1",
          email: "test@example.com",
          organizationId: "org-1",
          roles: ["learner"],
          products: ["lte"],
          membershipStatus: "active",
          emailVerified: true,
          userMetadata: { full_name: "Test User" },
        },
      } as unknown as WorkflowOutcome<IdentityDTO>);

      await useAuthStore.getState().exchangeCode(exchangeParams);

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().initialized).toBe(true);
    });

    it("throws and sets error on exchange failure", async () => {
      vi.mocked(authClient.initialize).mockRejectedValueOnce(new Error("Exchange failed"));

      await expect(useAuthStore.getState().exchangeCode(exchangeParams)).rejects.toThrow(
        "Exchange failed",
      );

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().error).toBe("Exchange failed");
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().initialized).toBe(true);
    });
  });

  describe("logout", () => {
    it("clears auth state on logout", async () => {
      useAuthStore.setState({
        user: mockAuthUser,
        isAuthenticated: true,
      });
      vi.mocked(authClient.logout).mockResolvedValueOnce({
        outcome: "current_session_revoked",
      } as unknown as CurrentSessionLogoutResult);

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("handles logout API failure gracefully", async () => {
      useAuthStore.setState({
        user: mockAuthUser,
        isAuthenticated: true,
      });
      vi.mocked(authClient.logout).mockRejectedValueOnce(new Error("API down"));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
