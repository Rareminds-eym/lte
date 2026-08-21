import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { useAuthStore } from "@/entities/session";
import { getLogger } from "@/shared";
import { ApplicationLoader } from "@/shared/ui";

const logger = getLogger("AuthInitializer");

function getExchangeKey(params: { code: string; state: string; redirectUri: string }): string {
  return `${params.redirectUri}:${params.code}:${params.state}`;
}

interface AuthInitializerProps {
  children: React.ReactNode;
}

/**
 * Centralized application authentication orchestrator.
 *
 * Responsibilities:
 *  1. Trigger the silent session refresh on first mount (outside SSO callback paths).
 *  2. Intercept SSO authorization-code callback flows and perform the token exchange.
 *  3. Display ApplicationLoader while any of the above are in-flight.
 *  4. Render children once the auth state is resolved.
 *
 * This removes auth initialization logic from MainLayout and DashboardLayout,
 * giving layouts a single responsibility: UI structure.
 */
export const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const user = useAuthStore((state) => state.user);
  const initialize = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);
  const loading = useAuthStore((state) => state.loading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const exchangeCode = useAuthStore((state) => state.exchangeCode);
  const authError = useAuthStore((state) => state.error);

  const [callbackError, setCallbackError] = useState<string | null>(null);

  // Guard to prevent multiple simultaneous initializations in React 18 Strict Mode
  const startedRef = useRef(false);

  // Deduplicate concurrent exchange requests (React StrictMode safe)
  const exchangeRequestsRef = useRef(new Map<string, Promise<void>>());

  // Validate and parse the redirection target (prevents open redirects / XSS)
  const targetNext = useMemo(() => {
    const next = searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//") && !next.startsWith(".")) {
      return next;
    }
    return "/dashboard";
  }, [searchParams]);

  // Detect SSO authorization-code callback parameters
  const callbackParams = useMemo(() => {
    if (isAuthenticated) {
      return null;
    }
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const redirectUri = `${window.location.origin}/auth/callback`;
    return code && state ? { code, state, redirectUri, targetNext } : null;
  }, [searchParams, targetNext, isAuthenticated]);

  // 1. Initial silent session refresh (skip on callback flows)
  useEffect(() => {
    if (location.pathname.startsWith("/auth/callback") || callbackParams) {
      return;
    }
    if (!initialized && !isAuthenticated) {
      if (startedRef.current) {
        return;
      }
      startedRef.current = true;
      logger.info("Calling initialize…");
      void initialize();
    }
  }, [initialize, initialized, isAuthenticated, location.pathname, callbackParams]);

  // 2. Authorization-code exchange when callback params are present
  useEffect(() => {
    if (!callbackParams || isAuthenticated) return;

    let cancelled = false;
    const exchangeKey = getExchangeKey(callbackParams);
    let exchangeRequest = exchangeRequestsRef.current.get(exchangeKey);

    if (!exchangeRequest) {
      logger.info("Starting code exchange…", callbackParams);
      exchangeRequest = exchangeCode(callbackParams).catch((error: unknown) => {
        exchangeRequestsRef.current.delete(exchangeKey);
        throw error;
      });
      exchangeRequestsRef.current.set(exchangeKey, exchangeRequest);
    }

    exchangeRequest
      .then(() => {
        if (!cancelled) {
          logger.info(`Exchange succeeded, navigating to ${targetNext}`);
          // Strip code and state completely from the browser URL address bar
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("code");
          cleanUrl.searchParams.delete("state");
          window.history.replaceState(
            {},
            "",
            cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ""),
          );
          navigate(targetNext, { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "SSO callback failed";
          // If code was already consumed (e.g. page refreshed) but session is active, don't show fatal error
          if (useAuthStore.getState().isAuthenticated) {
            logger.info("Code already exchanged; user is authenticated.");
            navigate(targetNext, { replace: true });
            return;
          }
          logger.error("Exchange failed", error instanceof Error ? error : new Error(message));
          setCallbackError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [callbackParams, exchangeCode, isAuthenticated, navigate, targetNext]);

  // 3. Orchestrate active learning path fetching once authenticated
  useEffect(() => {
    if (initialized && isAuthenticated && user?.id) {
      useLearningPathStore
        .getState()
        .fetchAndSetActiveLearningPath(user.id)
        .catch((error: unknown) => {
          logger.warn("Failed to fetch active learning path", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    } else if (initialized && !isAuthenticated) {
      useLearningPathStore.getState().clearActiveLearningPath();
    }
  }, [initialized, isAuthenticated, user?.id]);

  // ── Render gates ──────────────────────────────────────────────────────────

  // SSO callback flow: always show ApplicationLoader until exchange resolves.
  if (callbackParams || location.pathname.startsWith("/auth/callback")) {
    if (!callbackParams) {
      // Bare /auth/callback with no params — bounce to landing
      navigate("/", { replace: true });
      return <ApplicationLoader message="Redirecting…" />;
    }
    const message = callbackError ?? authError;
    if (message) {
      return (
        <main
          className="min-h-screen grid place-items-center p-8 bg-surface-secondary"
          role="alert"
          aria-live="assertive"
        >
          <section className="max-w-md w-full text-center bg-white rounded-2xl p-8 shadow-md border border-line-default space-y-6">
            <div>
              <h1 className="text-lg font-bold text-content-primary mb-2">Unable to sign in</h1>
              <p className="text-sm text-content-secondary">{message}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-brand-600 text-content-inverse font-semibold text-sm rounded-lg hover:bg-brand-700 transition-colors cursor-pointer"
              >
                Retry Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate("/login", { replace: true });
                  window.location.reload();
                }}
                className="px-4 py-2 border border-line-strong text-content-body font-semibold text-sm rounded-lg hover:bg-surface-muted transition-colors cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          </section>
        </main>
      );
    }
    return <ApplicationLoader message="Verifying your SkillPassport session…" />;
  }

  // Initial bootstrap: show ApplicationLoader while session is being resolved
  if (loading || !initialized) {
    return <ApplicationLoader message="Initializing…" />;
  }

  // Auth is resolved — hand control back to the route tree
  return <>{children}</>;
};
