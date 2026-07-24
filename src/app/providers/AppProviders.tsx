import type React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/shared/ui";

// ponytail: provider seam — add ThemeProvider, ToastProvider, QueryClientProvider etc. here
export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
);
