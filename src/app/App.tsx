import type React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { AppRouter } from "@/app/router/AppRouter";

export const App: React.FC = () => {
  return (
    <Router>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </Router>
  );
};
