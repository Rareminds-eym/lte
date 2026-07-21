import type React from "react";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/app/store";
import { getLogger } from "@/shared";

const logger = getLogger("MainLayout");

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const initialize = useAuthStore((state) => state.initialize);
  const loading = useAuthStore((state) => state.loading);
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authError = useAuthStore((state) => state.error);

  useEffect(() => {
    if (location.pathname.startsWith("/auth/callback")) {
      return;
    }

    if (!initialized && !isAuthenticated) {
      logger.info("Calling initialize...");
      void initialize();
    } else if (initialized && !isAuthenticated && !authError && location.pathname !== "/") {
      logger.info("Unauthenticated session on protected route. Initiating 0-click SSO check...");
      const skillpassportUrl = import.meta.env["VITE_SKILLPASSPORT_URL"] || "http://127.0.0.1:8788";
      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
      const ssoLoginUrl = `${skillpassportUrl}/login?target_app=lte&redirect_uri=${redirectUri}`;
      window.location.href = ssoLoginUrl;
    }
  }, [initialize, initialized, isAuthenticated, authError, location.pathname]);

  if (location.pathname.startsWith("/auth/callback") || location.pathname === "/") {
    return <Outlet />;
  }

  // Case 2: User is authenticated in SSO, but lacks LTE product entitlement
  if (
    authError &&
    (authError.includes("Access denied") || authError.includes("LTE access is required"))
  ) {
    const skillpassportUrl = import.meta.env["VITE_SKILLPASSPORT_URL"] || "http://127.0.0.1:8788";
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "#f8fafc",
        }}
      >
        <section
          style={{
            maxWidth: "28rem",
            textAlign: "center",
            background: "#ffffff",
            padding: "2.5rem 2rem",
            borderRadius: "1rem",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.75rem",
              color: "#0f172a",
            }}
          >
            LTE Access Required
          </h2>
          <p
            style={{
              color: "#64748b",
              fontSize: "0.95rem",
              lineHeight: 1.5,
              marginBottom: "1.75rem",
            }}
          >
            Your SkillPassport account does not currently have active LTE product access enabled.
          </p>
          <a
            href={skillpassportUrl}
            style={{
              display: "inline-block",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "0.95rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              textDecoration: "none",
            }}
          >
            Manage Subscription on SkillPassport
          </a>
        </section>
      </main>
    );
  }

  // Loading / Unauthenticated state for protected routes
  if (loading || !initialized || !isAuthenticated) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "#f8fafc",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "#1e293b",
              marginBottom: "0.5rem",
            }}
          >
            Authenticating...
          </p>
        </div>
      </main>
    );
  }

  logger.debug("Rendering outlet (authenticated)");
  return <Outlet />;
};
