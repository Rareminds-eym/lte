import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppRouter } from './router/AppRouter';
import { AppProviders } from './providers/AppProviders';

export const App: React.FC = () => {
  return (
    <Router>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </Router>
  );
};
