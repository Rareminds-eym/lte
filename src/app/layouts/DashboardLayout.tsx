import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/entities/session";
import { getLogger, getSkillpassportUrl, useUIStore } from "@/shared";
import {
  DASHBOARD_SCROLL_CONTAINER_ID,
  DESKTOP_NAVIGATION_MEDIA,
  ROUTES,
  UI_INTERACTION_CLASSES,
  UI_TEXT,
} from "@/shared/config";
import { containDialogFocus } from "@/shared/lib";
import { SectionBoundary } from "@/shared/ui";
import { Header, NavigationDrawer } from "@/widgets";

const logger = getLogger("DashboardLayout");

const DashboardScrollRestoration: React.FC = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const scrollContainer = document.getElementById(DASHBOARD_SCROLL_CONTAINER_ID);
    if (!scrollContainer) return;

    if (typeof scrollContainer.scrollTo === "function") {
      scrollContainer.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    scrollContainer.scrollTop = 0;
    scrollContainer.scrollLeft = 0;
  }, [pathname]);

  return null;
};

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const authError = useAuthStore((state) => state.error);
  const isCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const mobileDrawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const drawer = mobileDrawerRef.current;
    if (!drawer || !isMobileDrawerOpen) return;
    const trigger = document.activeElement;
    drawer.showModal();
    const desktop = window.matchMedia(DESKTOP_NAVIGATION_MEDIA);
    const onResize = () => {
      if (desktop.matches) setIsMobileDrawerOpen(false);
    };
    desktop.addEventListener("change", onResize);
    return () => {
      desktop.removeEventListener("change", onResize);
      drawer.close();
      if (trigger instanceof HTMLElement && trigger.getClientRects().length > 0) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [isMobileDrawerOpen]);

  // Case 1: User is authenticated in SSO but lacks LTE product entitlement
  if (
    authError &&
    (authError.includes("Access denied") || authError.includes("LTE access is required"))
  ) {
    const skillpassportUrl = getSkillpassportUrl();
    return (
      <main className="grid place-items-center min-h-screen bg-surface-secondary p-8">
        <section className="max-w-md w-full text-center bg-white px-8 py-10 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold mb-3 text-content-primary">
            {UI_TEXT.lteAccessRequired}
          </h2>
          <p className="text-content-secondary text-sm leading-relaxed mb-7">
            {UI_TEXT.accessDescription}
          </p>
          <a
            href={skillpassportUrl}
            className="inline-block bg-brand-600 text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-brand-700 transition-colors no-underline"
          >
            {UI_TEXT.manageSubscriptionOnSkillpassport}
          </a>
        </section>
      </main>
    );
  }

  // Case 2: Unauthenticated — redirect to login
  if (!isAuthenticated) {
    logger.info("User is not authenticated. Redirecting to LTE login page.");
    return <Navigate to={ROUTES.LOGIN} replace />;
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
    dashboard: ROUTES.DASHBOARD,
    "my-courses": ROUTES.MY_COURSES,
    settings: ROUTES.SETTINGS,
  };

  const handleNavigate = (id: string) => {
    setIsMobileDrawerOpen(false);
    const path = navPathMap[id];
    if (path) navigate(path);
  };

  const activeNavId = location.pathname.includes("settings")
    ? "settings"
    : location.pathname.includes("dashboard")
      ? "dashboard"
      : "my-courses";

  const pageTitleMap: Record<string, string> = {
    dashboard: UI_TEXT.dashboard,
    "my-courses": UI_TEXT.myLearning,
    settings: UI_TEXT.settings,
  };
  const pageTitle = pageTitleMap[activeNavId] ?? UI_TEXT.dashboard;

  return (
    // Clip the fixed shell without creating scroll containers for fragment links or focus.
    <div
      className={`dashboard-shell flex h-dvh bg-surface-secondary overflow-clip relative ${UI_INTERACTION_CLASSES}`}
    >
      <a
        href={`#${DASHBOARD_SCROLL_CONTAINER_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-surface-primary focus:text-brand-700 focus:px-4 focus:py-3 focus:rounded-lg focus:shadow-lg"
      >
        {UI_TEXT.skipToMainContent}
      </a>
      {/* Desktop Navigation Drawer */}
      <SectionBoundary label={UI_TEXT.mainNavigation}>
        <NavigationDrawer
          activeNavId={activeNavId}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleSidebar}
          onNavigate={handleNavigate}
          className="hidden lg:flex"
        />
      </SectionBoundary>

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileDrawerOpen && (
        <dialog
          ref={mobileDrawerRef}
          aria-label={UI_TEXT.navigationMenu}
          onCancel={() => setIsMobileDrawerOpen(false)}
          onKeyDown={containDialogFocus}
          className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 open:flex lg:hidden"
        >
          <button
            type="button"
            aria-label={UI_TEXT.closeNavigationDrawer}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs border-0 p-0"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <SectionBoundary label={UI_TEXT.mainNavigation}>
            <NavigationDrawer
              activeNavId={activeNavId}
              isCollapsed={false}
              onToggleCollapse={() => setIsMobileDrawerOpen(false)}
              onNavigate={handleNavigate}
              className="relative z-10 w-72 max-w-[calc(100%-3rem)] h-full shadow-2xl"
            />
          </SectionBoundary>
        </dialog>
      )}

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-clip">
        <SectionBoundary label={pageTitle}>
          <Header
            pageTitle={pageTitle}
            userName={userName}
            userStatus={userStatus}
            userEmail={user?.email}
            onToggleMobileDrawer={() => setIsMobileDrawerOpen(true)}
            mobileDrawerOpen={isMobileDrawerOpen}
            onSearchSubmit={(query) =>
              navigate(`${ROUTES.MY_COURSES}?q=${encodeURIComponent(query)}`)
            }
            onProfileClick={() => navigate(ROUTES.SETTINGS)}
            onLogoutClick={() => logout().catch((err) => logger.error("Logout failed", err))}
          />
        </SectionBoundary>
        <DashboardScrollRestoration />
        <main
          id={DASHBOARD_SCROLL_CONTAINER_ID}
          tabIndex={-1}
          aria-label={pageTitle}
          className="flex-1 p-4 lg:p-6 overflow-y-auto min-w-0 overscroll-contain"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
