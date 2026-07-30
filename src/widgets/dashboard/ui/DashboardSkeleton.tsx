import type React from "react";
import { Skeleton, SkeletonGroup } from "@/shared/ui";

/**
 * Dashboard layout skeleton.
 *
 * Mirrors the section/grid structure of DashboardPage exactly so that
 * when dashboard data is fetching the page has the correct dimensions
 * and no layout shift occurs.
 *
 * Ownership: widgets/dashboard — it describes the layout of dashboard widgets.
 */
export const DashboardSkeleton: React.FC = () => (
  <SkeletonGroup className="space-y-6 max-w-[1440px] mx-auto">
    {/* Row 0 — CareerTargetBanner */}
    <Skeleton className="h-32 w-full rounded-2xl" aria-label="Career target banner" />

    {/* Row 1 — JourneyHero (2/3) + TodaysPriorities (1/3) */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="lg:col-span-2 h-80 rounded-2xl" aria-label="Journey hero" />
      <Skeleton className="h-80 rounded-2xl" aria-label="Today's priorities" />
    </div>

    {/* Row 2 — CapabilityGapMap (1/2) + UpcomingFeedback (1/2) */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Skeleton className="h-80 rounded-2xl" aria-label="Capability gap map" />
      <Skeleton className="h-80 rounded-2xl" aria-label="Upcoming feedback" />
    </div>

    {/* Row 3 — CareerPaths (2/3) + Achievements (1/3) */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="lg:col-span-2 h-80 rounded-2xl" aria-label="Career paths" />
      <Skeleton className="h-80 rounded-2xl" aria-label="Achievements" />
    </div>
  </SkeletonGroup>
);
