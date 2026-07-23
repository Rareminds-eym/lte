import type React from "react";
import { Route, Routes } from "react-router-dom";
import { Dashboard } from "@/pages/Dashboard";
import { HomePage } from "@/pages/HomePage";
import { NotFound } from "@/pages/NotFound";
import { MainLayout } from "@/app/layouts/MainLayout";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/callback" element={null} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
