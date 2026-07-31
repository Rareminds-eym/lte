import type React from "react";
import { useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/entities/session";
import { getLogger, getSkillpassportUrl, useUIStore } from "@/shared";
import { Header, NavigationDrawer } from "@/widgets";

const logger = getLogger("DashboardLayout");

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authError = useAuthStore((state) => state.error);
  const isCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Case 1: User is authenticated in SSO but lacks LTE product entitlement
  if (
    authError &&
    (authError.includes("Access denied") || authError.includes("LTE access is required"))
  ) {
    const skillpassportUrl = getSkillpassportUrl();
    return (
      <main className="grid place-items-center min-h-screen bg-surface-secondary p-8">
        <section className="max-w-md w-full text-center bg-white px-8 py-10 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold mb-3 text-content-primary">LTE Access Required</h2>
          <p className="text-content-secondary text-sm leading-relaxed mb-7">
            Your SkillPassport account does not currently have active LTE product access enabled.
          </p>
          <a
            href={skillpassportUrl}
            className="inline-block bg-brand-600 text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-brand-700 transition-colors no-underline"
          >
            Manage Subscription on SkillPassport
          </a>
        </section>
      </main>
    );
  }

  // Case 2: Unauthenticated — redirect to login
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
    setIsMobileDrawerOpen(false);
    const path = navPathMap[id];
    if (path) navigate(path);
  };

  const activeNavId = location.pathname.includes("dashboard") ? "dashboard" : "my-courses";

  const pageTitle = activeNavId === "dashboard" ? "Dashboard" : "My Courses";

  return (
    <div className="flex h-screen bg-surface-secondary overflow-hidden relative">
      {/* Desktop Navigation Drawer */}
      <NavigationDrawer
        activeNavId={activeNavId}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebar}
        onNavigate={handleNavigate}
        className="hidden md:flex"
      />

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation drawer"
            className="fixed inset-0 bg-black/50 backdrop-blur-xs border-0 p-0"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <NavigationDrawer
            activeNavId={activeNavId}
            isCollapsed={false}
            onToggleCollapse={() => setIsMobileDrawerOpen(false)}
            onNavigate={handleNavigate}
            className="relative z-10 w-72 h-full shadow-2xl"
          />
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          pageTitle={pageTitle}
          userName={userName}
          userStatus={userStatus}
          userEmail={user?.email}
          onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
