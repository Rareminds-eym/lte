import type React from "react";
import { useEffect } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { AuthInitializer } from "@/app/providers/AuthInitializer";
import { XpModalProvider } from "@/app/providers/XpModalProvider";
import { AppRouter } from "@/app/router/AppRouter";
import { useAuthStore } from "@/entities/session";
import { registerTokenGetter } from "@/shared/api";

export const App: React.FC = () => {
  // Register the dependency injection getter inside useEffect to prevent module side effects
  useEffect(() => {
    registerTokenGetter(() => useAuthStore.getState().accessToken);
  }, []);

  return (
    <Router>
      <AppProviders>
        <AuthInitializer>
          <AppRouter />
          <XpModalProvider />
        </AuthInitializer>
      </AppProviders>
    </Router>
  );
};
