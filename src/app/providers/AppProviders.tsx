import type React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/shared/ui/ErrorFallback";

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>;
};
