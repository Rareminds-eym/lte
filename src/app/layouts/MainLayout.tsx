import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/app/store";
import { getLogger } from "@/shared";

const logger = getLogger("MainLayout");

function getExchangeKey(params: { code: string; state: string; redirectUri: string }): string {
  return `${params.redirectUri}:${params.code}:${params.state}`;
}

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Component-scoped cache to deduplicate concurrent exchange requests (React StrictMode safe)
  const exchangeRequestsRef = useRef(new Map<string, Promise<void>>());

  const initialize = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const exchangeCode = useAuthStore((state) => state.exchangeCode);
  const authError = useAuthStore((state) => state.error);

  const [callbackError, setCallbackError] = useState<string | null>(null);

  // Check if we are on a callback flow (either /auth/callback or code/state query parameters)
  const callbackParams = useMemo(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const redirectUri = `${window.location.origin}/auth/callback`;
    return code && state ? { code, state, redirectUri } : null;
  }, [searchParams]);

  // 1. Initial local session load in background (only if not doing callback)
  useEffect(() => {
    if (location.pathname.startsWith("/auth/callback") || callbackParams) {
      return;
    }

    if (!initialized && !isAuthenticated) {
      logger.info("Calling initialize...");
      void initialize();
    }
  }, [initialize, initialized, isAuthenticated, location.pathname, callbackParams]);

  // 2. Perform authorization code exchange if callback parameters are present
  useEffect(() => {
    if (!callbackParams) return;

    let cancelled = false;
    const exchangeKey = getExchangeKey(callbackParams);
    let exchangeRequest = exchangeRequestsRef.current.get(exchangeKey);

    if (!exchangeRequest) {
      logger.info("Starting code exchange...", callbackParams);
      exchangeRequest = exchangeCode(callbackParams).catch((error: unknown) => {
        exchangeRequestsRef.current.delete(exchangeKey);
        throw error;
      });
      exchangeRequestsRef.current.set(exchangeKey, exchangeRequest);
    }

    exchangeRequest
      .then(() => {
        if (!cancelled) {
          logger.info("Exchange succeeded, navigating to dashboard");
          window.history.replaceState({}, "", "/dashboard");
          navigate("/dashboard", { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "SSO callback failed";
          logger.error("Exchange failed", error instanceof Error ? error : new Error(message));
          setCallbackError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [callbackParams, exchangeCode, navigate, searchParams]);

  // If executing callback, intercept and render loading/error screen
  if (callbackParams || location.pathname.startsWith("/auth/callback")) {
    // If we routed to /auth/callback without params, redirect to landing
    if (!callbackParams) {
      return <Navigate to="/" replace />;
    }

    const message = callbackError ?? authError;

    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <section style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1>{message ? "Unable to sign in" : "Signing you in"}</h1>
          <p>{message ?? "Please wait while LTE verifies your SkillPassport session."}</p>
        </section>
      </main>
    );
  }

  return <Outlet />;
};
