import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../app/store";
import { getLogger } from "../../shared";

const logger = getLogger("SSOCallback");
const exchangeRequests = new Map<string, Promise<void>>();

function getExchangeKey(params: { code: string; state: string; redirectUri: string }): string {
  return `${params.redirectUri}:${params.code}:${params.state}`;
}

export const SSOCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const exchangeCode = useAuthStore((state) => state.exchangeCode);
  const authError = useAuthStore((state) => state.error);
  const [localError, setLocalError] = useState<string | null>(null);

  const callbackParams = useMemo(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const redirectUri = `${window.location.origin}/auth/callback`;
    return code && state ? { code, state, redirectUri } : null;
  }, [searchParams]);

  useEffect(() => {
    if (!callbackParams) return;

    let cancelled = false;
    const exchangeKey = getExchangeKey(callbackParams);
    let exchangeRequest = exchangeRequests.get(exchangeKey);

    if (!exchangeRequest) {
      exchangeRequest = exchangeCode(callbackParams).catch((error: unknown) => {
        exchangeRequests.delete(exchangeKey);
        throw error;
      });
      exchangeRequests.set(exchangeKey, exchangeRequest);
    }

    exchangeRequest
      .then(() => {
        if (!cancelled) {
          logger.info("Exchange succeeded, navigating to dashboard", {
            isAuthenticated: useAuthStore.getState().isAuthenticated,
            initialized: useAuthStore.getState().initialized,
            hasUser: !!useAuthStore.getState().user,
          });
          window.history.replaceState({}, "", "/dashboard");
          navigate("/dashboard", { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "SSO callback failed";
          logger.error("Exchange failed", error instanceof Error ? error : new Error(message));
          setLocalError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [callbackParams, exchangeCode, navigate]);

  if (!callbackParams) {
    return <Navigate to="/" replace />;
  }

  const message = localError ?? authError;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <section style={{ maxWidth: "32rem", textAlign: "center" }}>
        <h1>{message ? "Unable to sign in" : "Signing you in"}</h1>
        <p>{message ?? "Please wait while LTE verifies your SkillPassport session."}</p>
      </section>
    </main>
  );
};
