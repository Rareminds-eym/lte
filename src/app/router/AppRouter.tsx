import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Dashboard } from '../../pages/Dashboard';
import { NotFound } from '../../pages/NotFound';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
