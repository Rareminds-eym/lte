import type React from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/app/store";
import { getLogger, getSkillpassportUrl, useUIStore } from "@/shared";
import { Header, NavigationDrawer } from "@/widgets";

const logger = getLogger("DashboardLayout");

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authError = useAuthStore((state) => state.error);
  const isCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  // Case 1: Loading / Initializing state (page content skeleton)
  if (loading || !initialized) {
    return (
      <div className="flex h-screen bg-slate-50">
        <aside className="w-64 bg-white border-r border-slate-100 p-3.5 shrink-0">
          <div className="h-14 w-full bg-slate-200 rounded-lg animate-pulse mb-6" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-slate-100 px-6 flex items-center">
            <div className="h-8 w-48 bg-slate-200 rounded-full animate-pulse" />
          </header>
          <main className="flex-1 p-6">
            <div className="space-y-4">
              <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
            </div>
          </main>
        </div>
      </div>
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

  // ponytail: flat navId→path map, replace with route config when sidebar grows beyond 8 items
  const navPathMap: Record<string, string> = {
    dashboard: "/dashboard",
    "my-courses": "/my-courses",
  };

  const handleNavigate = (id: string) => {
    const path = navPathMap[id];
    if (path) navigate(path);
  };

  const activeNavId = location.pathname.includes("dashboard") ? "dashboard" : "my-courses";

  return (
    <div className="flex h-screen bg-surface-secondary">
      <NavigationDrawer
        activeNavId={activeNavId}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebar}
        onNavigate={handleNavigate}
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
