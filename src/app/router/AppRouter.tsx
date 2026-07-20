import type React from "react";
import { Route, Routes, useSearchParams } from "react-router-dom";
import { Dashboard } from "../../pages/Dashboard";
import { SSOCallback } from "../../pages/auth/SSOCallback";
import { NotFound } from "../../pages/NotFound";
import { MainLayout } from "../layouts/MainLayout";

const RootRouteHandler: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (code && state) {
    return <SSOCallback />;
  }

  return <Dashboard />;
};

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/auth/callback" element={<SSOCallback />} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<RootRouteHandler />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
