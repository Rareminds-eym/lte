import type React from "react";
import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { LevelPlayerLayout } from "@/app/layouts/LevelPlayerLayout";
import { MainLayout } from "@/app/layouts/MainLayout";
import { GuestGuard } from "@/app/router/guards";
import { PageLoader, RouteLoadingBoundary } from "@/shared/ui";

// Lazy loaded page components — must be declared at module scope (workspace rule)
const HomePage = lazy(() => import("@/pages/home").then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("@/pages/login").then((m) => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import("@/pages/dashboard").then((m) => ({ default: m.Dashboard })));
const Courses = lazy(() => import("@/pages/courses").then((m) => ({ default: m.Courses })));
const CourseDetail = lazy(() =>
  import("@/pages/course-detail").then((m) => ({ default: m.CourseDetail })),
);
const LevelContent = lazy(() =>
  import("@/pages/level-content").then((m) => ({ default: m.LevelContent })),
);
const LevelModules = lazy(() =>
  import("@/pages/level-modules").then((m) => ({ default: m.LevelModulesPage })),
);
const NotFound = lazy(() => import("@/pages/not-found").then((m) => ({ default: m.NotFound })));

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route
          path="/"
          element={
            <RouteLoadingBoundary fallback={<PageLoader message="Loading homepage..." />}>
              <HomePage />
            </RouteLoadingBoundary>
          }
        />
        <Route
          path="/login"
          element={
            <RouteLoadingBoundary fallback={<PageLoader message="Loading login page..." />}>
              <GuestGuard>
                <LoginPage />
              </GuestGuard>
            </RouteLoadingBoundary>
          }
        />
        <Route path="/auth/callback" element={null} />
        <Route element={<DashboardLayout />}>
          <Route
            path="/dashboard"
            element={
              <RouteLoadingBoundary fallback={<PageLoader message="Loading dashboard..." />}>
                <Dashboard />
              </RouteLoadingBoundary>
            }
          />
          <Route
            path="/my-courses"
            element={
              <RouteLoadingBoundary fallback={<PageLoader message="Loading courses..." />}>
                <Courses />
              </RouteLoadingBoundary>
            }
          />
          <Route
            path="/my-courses/:capabilityCode"
            element={
              <RouteLoadingBoundary fallback={<PageLoader message="Loading course details..." />}>
                <CourseDetail />
              </RouteLoadingBoundary>
            }
          />
          <Route
            path="/courses/:capabilityCode/levels/:levelId"
            element={
              <RouteLoadingBoundary fallback={<PageLoader message="Loading course modules..." />}>
                <LevelModules />
              </RouteLoadingBoundary>
            }
          />
        </Route>
        <Route element={<LevelPlayerLayout />}>
          <Route
            path="/courses/:levelId/modules/:moduleNo"
            element={
              <RouteLoadingBoundary fallback={<PageLoader message="Loading course content..." />}>
                <LevelContent />
              </RouteLoadingBoundary>
            }
          />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <RouteLoadingBoundary fallback={<PageLoader message="Loading page..." />}>
            <NotFound />
          </RouteLoadingBoundary>
        }
      />
    </Routes>
  );
};
