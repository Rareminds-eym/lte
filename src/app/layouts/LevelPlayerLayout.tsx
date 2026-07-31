import type React from "react";
import { useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/entities/session";
import { getLogger, getSkillpassportUrl, useUIStore } from "@/shared";
import { Header, NavigationDrawer } from "@/widgets";

const logger = getLogger("LevelPlayerLayout");

export const LevelPlayerLayout: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authError = useAuthStore((state) => state.error);
  const isCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  if (loading || !initialized) {
    return (
      <div className="flex h-screen bg-surface-secondary">
        <aside className="hidden md:block w-64 bg-white border-r border-line-subtle p-3.5 shrink-0">
          <div className="h-14 w-full bg-surface-muted rounded-lg animate-pulse mb-6" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-full bg-surface-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-line-subtle px-6 flex items-center">
            <div className="h-8 w-48 bg-surface-muted rounded-full animate-pulse" />
          </header>
          <div className="flex-1 bg-surface-secondary animate-pulse" />
        </div>
      </div>
    );
  }

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

  const navPathMap: Record<string, string> = {
    dashboard: "/dashboard",
    "my-courses": "/my-courses",
  };

  const handleNavigate = (id: string) => {
    setIsMobileDrawerOpen(false);
    const path = navPathMap[id];
    if (path) navigate(path);
  };

  return (
    <div className="flex h-screen bg-surface-secondary overflow-hidden relative">
      {/* Desktop Navigation Drawer */}
      <NavigationDrawer
        activeNavId="my-courses"
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleSidebar}
        onNavigate={handleNavigate}
        className="hidden md:flex"
      />

      {/* Mobile Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Close navigation drawer"
            className="fixed inset-0 bg-black/50 backdrop-blur-xs border-0 p-0"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <NavigationDrawer
            activeNavId="my-courses"
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
          pageTitle="Course Content"
          userName={userName}
          userStatus={userStatus}
          onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
        />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
