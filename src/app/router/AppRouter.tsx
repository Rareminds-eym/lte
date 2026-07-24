import type React from "react";
import { Route, Routes } from "react-router-dom";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { MainLayout } from "@/app/layouts/MainLayout";
import { GuestGuard } from "@/app/router/guards";
import { Courses } from "@/pages/Courses";
import { Dashboard } from "@/pages/Dashboard";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFound } from "@/pages/NotFound";

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/login"
          element={
            <GuestGuard>
              <LoginPage />
            </GuestGuard>
          }
        />
        <Route path="/auth/callback" element={null} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-courses" element={<Courses />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
