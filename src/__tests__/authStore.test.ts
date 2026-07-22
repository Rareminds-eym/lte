import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/app/store";
import * as authApi from "@/shared/api/authApi";
import type { AuthUser } from "@/shared/types/auth";

vi.mock("@/shared/api/authApi");

describe("authStore", () => {
  const mockUser: AuthUser = {
    id: "usr_123",
    email: "user@example.com",
    org_id: "org_123",
    roles: ["user"],
    products: ["lte"],
    membership_status: "active",
    is_email_verified: true,
    user_metadata: {},
  };

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      initialized: false,
      loading: false,
      error: null,
    });
    vi.resetAllMocks();
  });

  it("initializes with default state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.initialized).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("exchangeCode sets authenticated state on success", async () => {
    const mockAuthResponse = {
      access_token: "mock_token",
      expires_in: 900,
      user: mockUser,
    };

    vi.mocked(authApi.exchangeSsoCode).mockResolvedValue(mockAuthResponse);

    await useAuthStore.getState().exchangeCode({
      code: "test_code",
      state: "test_state",
      redirectUri: "http://localhost:8789/auth/callback",
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe("mock_token");
    expect(state.user).toEqual(mockUser);
    expect(state.initialized).toBe(true);
    expect(state.error).toBeNull();
  });

  it("exchangeCode handles failure gracefully by throwing and setting error state", async () => {
    vi.mocked(authApi.exchangeSsoCode).mockRejectedValue(new Error("Code expired"));

    await expect(
      useAuthStore.getState().exchangeCode({
        code: "expired_code",
        state: "test_state",
        redirectUri: "http://localhost:8789/auth/callback",
      }),
    ).rejects.toThrow("Code expired");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.initialized).toBe(true);
    expect(state.error).toBe("Code expired");
  });

  it("logout resets authentication state", async () => {
    useAuthStore.setState({
      user: mockUser,
      accessToken: "active_token",
      isAuthenticated: true,
      initialized: true,
    });

    vi.mocked(authApi.logoutSession).mockResolvedValue({ success: true });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.initialized).toBe(true);
  });
});
