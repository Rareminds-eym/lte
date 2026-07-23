import type React from "react";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/app/store";
import { getLogger, getSkillpassportUrl } from "@/shared";
import { Header, NavigationDrawer } from "@/widgets";

const logger = getLogger("DashboardLayout");

export const DashboardLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authError = useAuthStore((state) => state.error);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  // Case 1: Loading / Initializing state
  if (loading || !initialized) {
    return (
      <main className="grid place-items-center min-h-screen bg-slate-50 p-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800 mb-2">Authenticating...</p>
        </div>
      </main>
    );
  }

  // Case 2: User is authenticated in SSO, but lacks LTE product entitlement
  if (
    authError &&
    (authError.includes("Access denied") || authError.includes("LTE access is required"))
  ) {
    const skillpassportUrl = getSkillpassportUrl();
    return (
      <main className="grid place-items-center min-h-screen bg-slate-50 p-8">
        <section className="max-w-md w-full text-center bg-white px-8 py-10 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold mb-3 text-slate-900">LTE Access Required</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-7">
            Your SkillPassport account does not currently have active LTE product access enabled.
          </p>
          <a
            href={skillpassportUrl}
            className="inline-block bg-blue-600 text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors no-underline"
          >
            Manage Subscription on SkillPassport
          </a>
        </section>
      </main>
    );
  }

  // Case 3: Unauthenticated users on protected routes immediately land on LTE login page
  if (!isAuthenticated) {
    logger.info("User is not authenticated. Redirecting to LTE login page.");
    return <Navigate to="/login" replace />;
  }

  interface UserMetadata {
    full_name?: string;
    name?: string;
    status?: string;
    level?: string;
  }

  const userMeta = user?.user_metadata as UserMetadata | undefined;

  const userName =
    userMeta?.full_name || userMeta?.name || (user?.email ? user.email.split("@")[0] : undefined);

  const userStatus = userMeta?.status || userMeta?.level;

  const activeNavId = location.pathname.includes("dashboard") ? "dashboard" : "my-courses";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <NavigationDrawer
        activeNavId={activeNavId}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={userName} userStatus={userStatus} />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
