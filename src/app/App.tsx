import type React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { AuthInitializer } from "@/app/providers/AuthInitializer";
import { AppRouter } from "@/app/router/AppRouter";
import { useAuthStore } from "@/entities/session";
import { registerTokenGetter } from "@/shared/api";

// Register the dependency injection getter for implicit bearer token requests
registerTokenGetter(() => useAuthStore.getState().accessToken);

export const App: React.FC = () => {
  return (
    <Router>
      <AppProviders>
        <AuthInitializer>
          <AppRouter />
        </AuthInitializer>
      </AppProviders>
    </Router>
  );
};
