import type React from "react";
import { useDashboardData } from "@/entities/dashboard";
import {
  Achievements,
  CapabilityGapMap,
  CareerPaths,
  CareerTargetBanner,
  JourneyHero,
  TodaysPriorities,
  UpcomingFeedback,
} from "@/widgets";

export const Dashboard: React.FC = () => {
  const { data, isLoading, isError } = useDashboardData();

  // Loading state using Skeleton (Page Content Loading) as per .codereview.yml rules
  if (isLoading || !data) {
    return (
      <div className="space-y-6 max-w-[1440px] mx-auto animate-pulse">
        <div className="h-32 bg-surface-muted rounded-2xl w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-surface-muted rounded-2xl" />
          <div className="h-80 bg-surface-muted rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-surface-muted rounded-2xl" />
          <div className="h-80 bg-surface-muted rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-surface-muted rounded-2xl" />
          <div className="h-80 bg-surface-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center bg-surface-primary rounded-2xl border border-line-default max-w-lg mx-auto my-12 shadow-sm">
        <h2 className="text-lg font-bold text-content-primary mb-2">Unable to load Dashboard</h2>
        <p className="text-xs text-content-secondary mb-4">
          There was an error loading your dashboard metrics. Please try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-brand-600 text-content-inverse font-semibold text-xs rounded-lg hover:bg-brand-700 transition-colors cursor-pointer"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* Top Banner: Career Target & Overview */}
      <section aria-label="Career Target Summary">
        <CareerTargetBanner data={data.careerTarget} />
      </section>

      {/* Row 1: Journey Hero Banner + Today's Priorities */}
      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        aria-label="Journey and Priorities"
      >
        <div className="lg:col-span-2">
          <JourneyHero data={data.journey} />
        </div>
        <div>
          <TodaysPriorities data={data.priorities} />
        </div>
      </section>

      {/* Row 2: Capability Gap Map + Upcoming & Feedback */}
      <section
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        aria-label="Capabilities and Upcoming Events"
      >
        <div>
          <CapabilityGapMap data={data.capabilityGaps} />
        </div>
        <div>
          <UpcomingFeedback data={data.upcomingFeedback} />
        </div>
      </section>

      {/* Row 3: Recommended Career Paths + Achievements */}
      <section
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        aria-label="Career Paths and Achievements"
      >
        <div className="lg:col-span-2">
          <CareerPaths data={data.careerPaths} />
        </div>
        <div>
          <Achievements data={data.achievements} />
        </div>
      </section>
    </div>
  );
};
