import type React from "react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/app/store";
import { getLogger, getSkillpassportUrl } from "@/shared";

const logger = getLogger("DashboardLayout");

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const loading = useAuthStore((state) => state.loading);
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authError = useAuthStore((state) => state.error);

  const [silentChecking, setSilentChecking] = useState(true);

  // 1. Silent SSO check if local session is absent on protected route
  useEffect(() => {
    if (
      !initialized ||
      isAuthenticated ||
      !silentChecking ||
      location.pathname === "/" ||
      location.pathname.startsWith("/auth/callback")
    ) {
      return;
    }

    async function performSilentSso() {
      logger.info("No local session. Performing background silent SSO check...");
      try {
        const skillpassportUrl = getSkillpassportUrl();
        const res = await fetch(`${skillpassportUrl}/api/auth/silent-sso`, {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          const data = (await res.json()) as { redirectUrl: string };
          if (data?.redirectUrl) {
            logger.info("Silent SSO check succeeded. Initiating local callback exchange...");
            window.location.href = data.redirectUrl;
            return;
          }
        }
      } catch (err) {
        logger.error(
          "Silent SSO background check failed:",
          err instanceof Error ? err : new Error(String(err)),
        );
      }
      setSilentChecking(false);
    }

    void performSilentSso();
  }, [initialized, isAuthenticated, silentChecking, location.pathname]);

  // Case 1: User is authenticated in SSO, but lacks LTE product entitlement
  if (
    authError &&
    (authError.includes("Access denied") || authError.includes("LTE access is required"))
  ) {
    const skillpassportUrl = getSkillpassportUrl();
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

  // Case 2: Loading / Unauthenticated state for protected routes while checking is in progress
  if (loading || !initialized || (silentChecking && !isAuthenticated)) {
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

  if (!isAuthenticated) {
    throw new Error(
      authError ||
        "LTE Access Required: You need an active SkillPassport session with LTE access to view this learning dashboard.",
    );
  }

  logger.debug("Rendering dashboard layout outlet (authenticated)");
  return <Outlet />;
};
