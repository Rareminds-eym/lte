import type React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { AuthInitializer } from "@/app/providers/AuthInitializer";
import { XpModalProvider } from "@/app/providers/XpModalProvider";
import { AppRouter } from "@/app/router/AppRouter";

export const App: React.FC = () => {
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
