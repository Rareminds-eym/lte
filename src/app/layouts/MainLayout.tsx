import type React from "react";
import { Outlet } from "react-router-dom";

/**
 * MainLayout — top-level route shell.
 *
 * Authentication initialization and SSO callback exchange are handled
 * by AuthInitializer (app/providers/AuthInitializer) before any route renders.
 *
 * This layout is a pure pass-through. Add global chrome here
 * (e.g. a toast container or a top progress bar) if needed.
 */
export const MainLayout: React.FC = () => <Outlet />;
