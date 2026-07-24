import type React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/app/store";

export const GuestGuard = ({ children }: { children: React.ReactNode }) => {
  if (useAuthStore((s) => s.isAuthenticated)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
