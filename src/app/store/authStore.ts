import { create } from "zustand";
import { getLogger } from "@/shared";
import { exchangeSsoCode, fetchMe, logoutSession, refreshSession } from "@/shared/api/authApi";
import type { AuthUser } from "@/shared/types/auth";

const logger = getLogger("authStore");

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  exchangeCode: (params: { code: string; state: string; redirectUri: string }) => Promise<void>;
  logout: () => Promise<void>;
  setAccessToken: (accessToken: string | null) => void;
}

function buildAuthenticatedState(accessToken: string, user: AuthUser): Partial<AuthState> {
  return {
    accessToken,
    user,
    isAuthenticated: true,
    error: null,
  };
}

function buildSignedOutState(error: string | null = null): Partial<AuthState> {
  return {
    accessToken: null,
    user: null,
    isAuthenticated: false,
    error,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  loading: true,
  initialized: false,
  error: null,

  setAccessToken: (accessToken) => {
    logger.info("setAccessToken", { accessToken: accessToken ? "SET" : "NULL" });
    set({ accessToken });
  },

  initialize: async () => {
    const currentState = useAuthStore.getState();
    logger.info("initialize starting", {
      initialized: currentState.initialized,
      isAuthenticated: currentState.isAuthenticated,
      hasAccessToken: !!currentState.accessToken,
      hasUser: !!currentState.user,
    });

    if (currentState.isAuthenticated && currentState.initialized) {
      logger.info("initialize already authenticated, skipping");
      return;
    }

    set({ loading: true, error: null });
    try {
      const refreshed = await refreshSession();
      const me = await fetchMe(refreshed.access_token);
      set({
        ...buildAuthenticatedState(refreshed.access_token, me.user),
        loading: false,
        initialized: true,
      });
      logger.info("initialize succeeded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Session initialization failed";
      logger.info("initialize failed", { message });
      set({
        ...buildSignedOutState(null),
        loading: false,
        initialized: true,
      });
    }
  },

  exchangeCode: async (params) => {
    set({ loading: true, error: null });
    try {
      logger.info("Calling exchangeSsoCode", {
        code: `${params.code.substring(0, 10)}...`,
        state: `${params.state.substring(0, 10)}...`,
        redirectUri: params.redirectUri,
      });

      const exchanged = await exchangeSsoCode(params);

      logger.info("Exchange successful", {
        hasAccessToken: !!exchanged.access_token,
        hasUser: !!exchanged.user,
        userEmail: exchanged.user?.email,
        userId: exchanged.user?.id,
      });

      set({
        ...buildAuthenticatedState(exchanged.access_token, exchanged.user),
        loading: false,
        initialized: true,
      });

      logger.info("Auth state updated", {
        isAuthenticated: true,
        initialized: true,
        userEmail: exchanged.user?.email,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SSO exchange failed";
      logger.error("Exchange failed", error instanceof Error ? error : new Error(message));
      set({
        ...buildSignedOutState(message),
        loading: false,
        initialized: true,
      });
      throw error;
    }
  },

  logout: async () => {
    await logoutSession().catch(() => ({ success: false }));
    set({
      ...buildSignedOutState(null),
      loading: false,
      initialized: true,
    });
  },
}));

export const selectAuthReady = () => {
  const state = useAuthStore.getState();
  return !state.loading && state.isAuthenticated;
};

if (import.meta.env.DEV) {
  useAuthStore.subscribe((state) => {
    logger.debug("State changed", {
      isAuthenticated: state.isAuthenticated,
      initialized: state.initialized,
      hasUser: !!state.user,
      hasAccessToken: !!state.accessToken,
      loading: state.loading,
      error: state.error,
    });
  });
}
