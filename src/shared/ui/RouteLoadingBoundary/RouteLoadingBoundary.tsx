import type React from "react";
import { Suspense } from "react";
import { RouteContentSkeleton } from "./RouteContentSkeleton";

interface RouteLoadingBoundaryProps {
  /**
   * The lazy-loaded page component.
   */
  children: React.ReactNode;
  /**
   * Optional custom fallback. Defaults to <RouteContentSkeleton />.
   * Pass a page-specific skeleton component here when the page layout is already known.
   */
  fallback?: React.ReactNode;
}

/**
 * Wraps a lazy route in a Suspense boundary with a layout-friendly fallback.
 *
 * Defaults to RouteContentSkeleton so that loading a sub-route chunk
 * does not blow away the layout header and sidebar shell.
 */
export const RouteLoadingBoundary: React.FC<RouteLoadingBoundaryProps> = ({
  children,
  fallback,
}) => <Suspense fallback={fallback ?? <RouteContentSkeleton />}>{children}</Suspense>;
