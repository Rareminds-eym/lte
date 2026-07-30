import type React from "react";
import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { MainLayout } from "@/app/layouts/MainLayout";
import { GuestGuard } from "@/app/router/guards";
import { RouteLoadingBoundary } from "@/shared/ui";
import { DashboardSkeleton } from "@/widgets/dashboard";

// Lazy loaded page components — must be declared at module scope (workspace rule)
const HomePage = lazy(() => import("@/pages/home").then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("@/pages/login").then((m) => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import("@/pages/dashboard").then((m) => ({ default: m.Dashboard })));
const Courses = lazy(() => import("@/pages/courses").then((m) => ({ default: m.Courses })));
const CourseDetail = lazy(() =>
  import("@/pages/course-detail").then((m) => ({ default: m.CourseDetail })),
);
const NotFound = lazy(() => import("@/pages/not-found").then((m) => ({ default: m.NotFound })));

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route
          path="/"
          element={
            <RouteLoadingBoundary>
              <HomePage />
            </RouteLoadingBoundary>
          }
        />
        <Route
          path="/login"
          element={
            <RouteLoadingBoundary>
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
              <RouteLoadingBoundary fallback={<DashboardSkeleton />}>
                <Dashboard />
              </RouteLoadingBoundary>
            }
          />
          <Route
            path="/my-courses"
            element={
              <RouteLoadingBoundary>
                <Courses />
              </RouteLoadingBoundary>
            }
          />
          <Route
            path="/my-courses/:capabilityCode"
            element={
              <RouteLoadingBoundary>
                <CourseDetail />
              </RouteLoadingBoundary>
            }
          />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <RouteLoadingBoundary>
            <NotFound />
          </RouteLoadingBoundary>
        }
      />
    </Routes>
  );
};
