import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/app/store";
import * as authApi from "@/shared/api/authApi";
import type { AuthUser } from "@/shared/types/auth";
import type { Mock } from "vitest";

vi.mock("@/shared/api/authApi", () => ({
  refreshSession: vi.fn(),
  fetchMe: vi.fn(),
  exchangeSsoCode: vi.fn(),
  logoutSession: vi.fn(),
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
    accessToken: null,
    user: null,
    isAuthenticated: false,
    loading: true,
    initialized: false,
    error: null,
    initialize: useAuthStore.getState().initialize,
    exchangeCode: useAuthStore.getState().exchangeCode,
    logout: useAuthStore.getState().logout,
    setAccessToken: useAuthStore.getState().setAccessToken,
  });
  vi.clearAllMocks();
});

describe("authStore", () => {
  describe("setAccessToken", () => {
    it("sets the access token", () => {
      useAuthStore.getState().setAccessToken("test-token");
      expect(useAuthStore.getState().accessToken).toBe("test-token");
    });

    it("sets access token to null", () => {
      useAuthStore.getState().setAccessToken(null);
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe("initialize", () => {
    it("skips if already authenticated and initialized", async () => {
      useAuthStore.setState({ isAuthenticated: true, initialized: true });
      await useAuthStore.getState().initialize();
      expect(authApi.refreshSession).not.toHaveBeenCalled();
    });

    it("restores session on success", async () => {
      (authApi.refreshSession as Mock).mockResolvedValue({ access_token: "new-token" });
      (authApi.fetchMe as Mock).mockResolvedValue({ user: mockAuthUser });

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().accessToken).toBe("new-token");
      expect(useAuthStore.getState().user).toEqual(mockAuthUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().initialized).toBe(true);
    });

    it("handles session failure gracefully", async () => {
      (authApi.refreshSession as Mock).mockRejectedValue(new Error("Network error"));

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().error).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().initialized).toBe(true);
    });

    it("handles session failure with non-Error thrown", async () => {
      (authApi.refreshSession as Mock).mockRejectedValue("just a string");

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().initialized).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  describe("exchangeCode", () => {
    const exchangeParams = {
      code: "abc123",
      state: "state123",
      redirectUri: "http://localhost/auth/callback",
    };

    it("exchanges code and sets authenticated state", async () => {
      (authApi.exchangeSsoCode as Mock).mockResolvedValue({
        access_token: "exchanged-token",
        user: mockAuthUser,
      });

      await useAuthStore.getState().exchangeCode(exchangeParams);

      expect(useAuthStore.getState().accessToken).toBe("exchanged-token");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().initialized).toBe(true);
    });

    it("throws and sets error on exchange failure", async () => {
      (authApi.exchangeSsoCode as Mock).mockRejectedValue(new Error("Exchange failed"));

      await expect(useAuthStore.getState().exchangeCode(exchangeParams)).rejects.toThrow(
        "Exchange failed",
      );

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().error).toBe("Exchange failed");
      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().initialized).toBe(true);
    });

    it("sets default error message on exchange failure with non-Error", async () => {
      (authApi.exchangeSsoCode as Mock).mockRejectedValue(42);

      await expect(useAuthStore.getState().exchangeCode(exchangeParams)).rejects.toBe(42);

      expect(useAuthStore.getState().error).toBe("SSO exchange failed");
    });
  });

  describe("logout", () => {
    it("clears auth state on logout", async () => {
      useAuthStore.setState({
        accessToken: "token",
        user: mockAuthUser,
        isAuthenticated: true,
      });
      (authApi.logoutSession as Mock).mockResolvedValue({ success: true });

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("handles logout API failure gracefully", async () => {
      useAuthStore.setState({
        accessToken: "token",
        user: mockAuthUser,
        isAuthenticated: true,
      });
      (authApi.logoutSession as Mock).mockRejectedValue(new Error("API down"));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
