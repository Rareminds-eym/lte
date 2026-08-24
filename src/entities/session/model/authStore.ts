import { create } from "zustand";
import { getLogger } from "@/shared";
import { apiPreAuthFetch, authClient } from "@/shared/api";
import { queryClient } from "@/shared/lib/queryClient";
import type { AuthUser } from "@/shared/types/auth";

const logger = getLogger("authStore");

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  exchangeCode: (params: {
    code: string;
    state: string;
    redirectUri: string;
    targetNext?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  initialized: false,
  error: null,

  initialize: async () => {
    const currentState = get();
    logger.info("initialize starting", {
      initialized: currentState.initialized,
      isAuthenticated: currentState.isAuthenticated,
    });

    if (currentState.isAuthenticated && currentState.initialized) {
      logger.info("initialize already authenticated, skipping");
      return;
    }

    set({ loading: true, error: null });
    try {
      const outcome = await authClient.initialize();
      if (outcome.status === "authenticated") {
        const identityResult = await authClient.getMe();
        let user: AuthUser | null = null;
        if (identityResult.status === "succeeded") {
          const d = identityResult.data;
          user = {
            id: d.subject,
            email: d.email,
            org_id: d.organizationId,
            roles: [...d.roles],
            products: [...d.products],
            membership_status: d.membershipStatus,
            is_email_verified: d.emailVerified,
            user_metadata: (d.userMetadata as Record<string, unknown>) ?? {},
          };
        }
        // Only trust the authenticated state when identity resolution succeeded;
        // otherwise route gates would render user-dependent screens against a
        // null user. The refresh cookie survives, so a reload retries cleanly.
        const trusted = user !== null;
        set({
          user,
          isAuthenticated: trusted,
          loading: false,
          initialized: true,
          error: null,
        });
        if (trusted) {
          logger.info("initialize succeeded");
        } else {
          logger.warn("initialize authenticated but identity fetch failed");
        }
      } else {
        set({
          user: null,
          isAuthenticated: false,
          loading: false,
          initialized: true,
          error: null,
        });
        logger.info("initialize resolved unauthenticated");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Session initialization failed";
      logger.info("initialize failed", { message });
      set({ user: null, isAuthenticated: false, loading: false, initialized: true, error: null });
    }
  },

  exchangeCode: async (params) => {
    set({ loading: true, error: null });
    try {
      logger.info("Calling exchangeSsoCode", {
        hasCode: !!params.code,
        hasState: !!params.state,
        redirectUri: params.redirectUri,
        targetNext: params.targetNext,
      });

      // Pre-auth endpoint: no access token exists yet, so this must use the
      // sanctioned pre-auth client path (bounded timeout + ApiError parsing).
      await apiPreAuthFetch("/api/v1/auth/sso/exchange", {
        method: "POST",
        body: JSON.stringify({
          code: params.code,
          state: params.state,
          redirectUri: params.redirectUri,
        }),
      });

      const outcome = await authClient.initialize();
      const identityResult = await authClient.getMe();

      let user: AuthUser | null = null;
      if (identityResult.status === "succeeded") {
        const d = identityResult.data;
        user = {
          id: d.subject,
          email: d.email,
          org_id: d.organizationId,
          roles: [...d.roles],
          products: [...d.products],
          membership_status: d.membershipStatus,
          is_email_verified: d.emailVerified,
          user_metadata: (d.userMetadata as Record<string, unknown>) ?? {},
        };
      }

      // Exchange succeeded server-side but identity could not be resolved:
      // surface an error rather than a half-authenticated state.
      if (outcome.status === "authenticated" && user === null) {
        throw new Error("Signed in, but the user profile could not be loaded. Please retry.");
      }

      set({
        user,
        isAuthenticated: outcome.status === "authenticated",
        loading: false,
        initialized: true,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SSO exchange failed";
      logger.error("Exchange failed", error instanceof Error ? error : new Error(message));
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        initialized: true,
        error: message,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authClient.logout();
    } catch (error) {
      // Local cleanup must proceed regardless; still record that the server
      // may not have terminated the session.
      logger.warn("Logout transport failed; local state cleared anyway", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      queryClient.clear();
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        initialized: true,
        error: null,
      });
    }
  },
}));

// Subscribe to AuthClient state transitions
authClient.subscribe((event) => {
  const phase = event.state.phase;
  if (phase === "unauthenticated" || phase === "destroyed") {
    queryClient.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      initialized: true,
    });
  }
});

if (import.meta.env.DEV) {
  useAuthStore.subscribe((state) => {
    logger.debug("State changed", {
      isAuthenticated: state.isAuthenticated,
      initialized: state.initialized,
      hasUser: !!state.user,
      loading: state.loading,
      error: state.error,
    });
  });
}
