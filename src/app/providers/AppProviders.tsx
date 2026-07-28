import { QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { queryClient } from "@/shared/lib";
import { ErrorFallback } from "@/shared/ui";

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </ErrorBoundary>
);
