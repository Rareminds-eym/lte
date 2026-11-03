import type React from "react";
import { DASHBOARD_ROW_HEIGHTS, UI_TEXT } from "@/shared/config";
import { Skeleton, SkeletonGroup } from "@/shared/ui";

/**
 * Dashboard page loading skeleton.
 * Mirrors the section/grid structure of DashboardPage to prevent layout shift.
 */
export const DashboardSkeleton: React.FC = () => (
  <SkeletonGroup
    className="space-y-6 max-w-[1440px] mx-auto"
    aria-label={UI_TEXT.loadingDashboardLabel}
  >
    {/* Row 0 — CareerTargetBanner */}
    <Skeleton className="h-[390px] xl:h-40 w-full rounded-2xl" />

    {/* Row 1 — JourneyHero (2/3) + TodaysPriorities (1/3) */}
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${DASHBOARD_ROW_HEIGHTS.journey}`}>
      <Skeleton className="lg:col-span-2 h-[440px] lg:h-full rounded-2xl" />
      <Skeleton className="h-80 lg:h-full rounded-2xl" />
    </div>

    {/* Row 2 — CapabilityGapMap (1/2) + UpcomingFeedback (1/2) */}
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${DASHBOARD_ROW_HEIGHTS.capabilities}`}>
      <Skeleton className="h-80 lg:h-full rounded-2xl" />
      <Skeleton className="h-80 lg:h-full rounded-2xl" />
    </div>

    {/* Row 3 — CareerPaths (2/3) + Achievements (1/3) */}
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${DASHBOARD_ROW_HEIGHTS.careers}`}>
      <Skeleton className="lg:col-span-2 h-[25rem] lg:h-full rounded-2xl" />
      <Skeleton className="h-[22.5rem] lg:h-full rounded-2xl" />
    </div>
  </SkeletonGroup>
);
