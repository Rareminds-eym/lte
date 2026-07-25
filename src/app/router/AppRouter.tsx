import type React from "react";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { MainLayout } from "@/app/layouts/MainLayout";
import { GuestGuard } from "@/app/router/guards";
import { PageLoader } from "@/shared/ui";

// Lazy loaded page components
const HomePage = lazy(() => import("@/pages/HomePage").then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Courses = lazy(() => import("@/pages/Courses").then((m) => ({ default: m.Courses })));
const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route
          path="/"
          element={
            <Suspense fallback={<PageLoader message="Loading Homepage..." />}>
              <HomePage />
            </Suspense>
          }
        />
        <Route
          path="/login"
          element={
            <Suspense fallback={<PageLoader message="Loading Sign In..." />}>
              <GuestGuard>
                <LoginPage />
              </GuestGuard>
            </Suspense>
          }
        />
        <Route path="/auth/callback" element={null} />
        <Route element={<DashboardLayout />}>
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<PageLoader message="Loading Dashboard..." />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/my-courses"
            element={
              <Suspense fallback={<PageLoader message="Loading Courses..." />}>
                <Courses />
              </Suspense>
            }
          />
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <Suspense fallback={<PageLoader message="Loading Page..." />}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
  );
};
