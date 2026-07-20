import type React from "react";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store";
import { getLogger } from "../../shared";

const logger = getLogger("MainLayout");

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const initialize = useAuthStore((state) => state.initialize);
  const loading = useAuthStore((state) => state.loading);
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    logger.debug("Effect triggered", {
      initialized,
      isAuthenticated,
      loading,
      pathname: location.pathname,
    });

    if (!initialized && !isAuthenticated) {
      logger.info("Calling initialize...");
      void initialize();
    } else {
      logger.debug("Skipping initialize (already initialized or authenticated)");
    }
  }, [initialize, initialized, isAuthenticated, loading, location.pathname]);

  if (loading || !initialized) {
    logger.debug("Showing loading state", { loading, initialized });
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <p>Loading LTE session...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    logger.info("Not authenticated, rendering access prompt", { from: location.pathname });
    const skillpassportUrl = import.meta.env["VITE_SKILLPASSPORT_URL"];
    if (!skillpassportUrl) {
      throw new Error("VITE_SKILLPASSPORT_URL is not configured");
    }

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
            You need an active SkillPassport session with LTE access to view this learning
            dashboard.
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
            Sign In with SkillPassport
          </a>
        </section>
      </main>
    );
  }

  logger.debug("Rendering outlet (authenticated)");
  return <Outlet />;
};
