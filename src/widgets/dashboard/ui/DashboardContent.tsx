import type React from "react";
import type { DashboardData } from "@/entities/dashboard";
import { DASHBOARD_ROW_HEIGHTS, UI_TEXT } from "@/shared/config";
import { SectionBoundary } from "@/shared/ui";
import { Achievements } from "@/widgets/dashboard/achievements";
import { CapabilityGapMap } from "@/widgets/dashboard/capability-gap-map";
import { CareerPaths } from "@/widgets/dashboard/career-paths";
import { CareerTargetBanner } from "@/widgets/dashboard/career-target-banner";
import { JourneyHero } from "@/widgets/dashboard/journey-hero";
import { TodaysPriorities } from "@/widgets/dashboard/todays-priorities";
import { UpcomingFeedback } from "@/widgets/dashboard/upcoming-feedback";

export interface DashboardContentProps {
  data: DashboardData;
  onRetryFeedback?: () => void;
  retryingFeedback?: boolean;
}

/**
 * Composes the full set of dashboard widget sections.
 *
 * Extracted from DashboardPage to keep the page thin and allow
 * the widget layer to own the layout composition.
 *
 * Only rendered when data is successfully fetched.
 */
export const DashboardContent: React.FC<DashboardContentProps> = ({
  data,
  onRetryFeedback,
  retryingFeedback,
}) => (
  <div className="dashboard-content space-y-6 max-w-[1440px] mx-auto min-w-0">
    {/* Top Banner: Career Target & Overview */}
    <section aria-label={UI_TEXT.careerTargetSummary}>
      <SectionBoundary label={UI_TEXT.careerTarget}>
        <CareerTargetBanner data={data.careerTarget} />
      </SectionBoundary>
    </section>

    {/* Row 1: Journey Hero Banner + Today's Priorities */}
    <section
      className={`grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch ${DASHBOARD_ROW_HEIGHTS.journey}`}
      aria-label={UI_TEXT.journeyAndPriorities}
    >
      <div className="lg:col-span-2 min-w-0 lg:[&>section]:h-full">
        <SectionBoundary label={UI_TEXT.journeyProgress}>
          <JourneyHero data={data.journey} state={data.journeyState} />
        </SectionBoundary>
      </div>
      <div className="min-w-0 lg:[&>section]:h-full">
        <SectionBoundary label={UI_TEXT.todaySPriorities}>
          <TodaysPriorities data={data.priorities} />
        </SectionBoundary>
      </div>
    </section>

    {/* Row 2: Capability Gap Map + Upcoming & Feedback */}
    <section
      className={`grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch ${DASHBOARD_ROW_HEIGHTS.capabilities}`}
      aria-label={UI_TEXT.capabilitiesAndUpcomingEvents}
    >
      <div
        id="capability-gap-map"
        tabIndex={-1}
        className="min-w-0 scroll-mt-6 lg:[&>section]:h-full"
      >
        <SectionBoundary label={UI_TEXT.capabilityGapMap}>
          <CapabilityGapMap data={data.capabilityGaps} />
        </SectionBoundary>
      </div>
      <div
        id="dashboard-feedback"
        tabIndex={-1}
        className="min-w-0 scroll-mt-6 lg:[&>section]:h-full"
      >
        <SectionBoundary label={UI_TEXT.upcomingFeedback}>
          <UpcomingFeedback
            data={data.upcomingFeedback}
            onRetry={onRetryFeedback}
            retrying={retryingFeedback}
          />
        </SectionBoundary>
      </div>
    </section>

    {/* Row 3: Recommended Career Paths + Achievements */}
    <section
      className={`grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch ${DASHBOARD_ROW_HEIGHTS.careers}`}
      aria-label={UI_TEXT.careerPathsAndAchievements}
    >
      <div
        id="career-paths"
        tabIndex={-1}
        className="lg:col-span-2 min-w-0 scroll-mt-6 lg:[&>section]:h-full"
      >
        <SectionBoundary label={UI_TEXT.recommendedCareerPaths}>
          <CareerPaths data={data.careerPaths} />
        </SectionBoundary>
      </div>
      <div id="achievements" tabIndex={-1} className="min-w-0 scroll-mt-6 lg:[&>section]:h-full">
        <SectionBoundary label={UI_TEXT.achievements}>
          <Achievements data={data.achievements} />
        </SectionBoundary>
      </div>
    </section>
  </div>
);
