import type React from "react";
import { Skeleton, SkeletonGroup } from "@/shared/ui/Skeleton";

/**
 * A generic page content skeleton designed to fit inside the application layouts
 * (like DashboardLayout or MainLayout) without causing major layout shifts.
 */
export const RouteContentSkeleton: React.FC = () => (
  <SkeletonGroup
    className="p-6 space-y-6 max-w-[1440px] mx-auto"
    aria-label="Loading page content…"
  >
    {/* Page Header Placeholder */}
    <div className="space-y-2">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-4 w-96 rounded" />
    </div>

    {/* Content Grid Placeholder */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="border border-gray-200 rounded-2xl p-5 space-y-4 bg-white shadow-sm"
        >
          <Skeleton className="h-6 w-1/3 rounded" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>
      ))}
    </div>

    {/* Content Rows Placeholder */}
    <div className="space-y-4 pt-4">
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-5/6 rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
    </div>
  </SkeletonGroup>
);
