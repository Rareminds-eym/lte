import type React from "react";
import type { DashboardData } from "@/entities/dashboard";
import { Achievements } from "@/widgets/dashboard/achievements";
import { CapabilityGapMap } from "@/widgets/dashboard/capability-gap-map";
import { CareerPaths } from "@/widgets/dashboard/career-paths";
import { CareerTargetBanner } from "@/widgets/dashboard/career-target-banner";
import { JourneyHero } from "@/widgets/dashboard/journey-hero";
import { TodaysPriorities } from "@/widgets/dashboard/todays-priorities";
import { UpcomingFeedback } from "@/widgets/dashboard/upcoming-feedback";

interface DashboardContentProps {
  data: DashboardData;
}

/**
 * Composes the full set of dashboard widget sections.
 *
 * Extracted from DashboardPage to keep the page thin and allow
 * the widget layer to own the layout composition.
 *
 * Only rendered when data is successfully fetched.
 */
export const DashboardContent: React.FC<DashboardContentProps> = ({ data }) => (
  <div className="space-y-6 max-w-[1440px] mx-auto">
    {/* Top Banner: Career Target & Overview */}
    <section aria-label="Career Target Summary">
      <CareerTargetBanner data={data.careerTarget} />
    </section>

    {/* Row 1: Journey Hero Banner + Today's Priorities */}
    <section
      className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
      aria-label="Journey and Priorities"
    >
      <div className="lg:col-span-2 h-full">
        <JourneyHero data={data.journey} state={data.journeyState} />
      </div>
      <div className="h-full">
        <TodaysPriorities data={data.priorities} />
      </div>
    </section>

    {/* Row 2: Capability Gap Map + Upcoming & Feedback */}
    <section
      className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch"
      aria-label="Capabilities and Upcoming Events"
    >
      <div className="h-full">
        <CapabilityGapMap data={data.capabilityGaps} />
      </div>
      <div className="h-full">
        <UpcomingFeedback data={data.upcomingFeedback} />
      </div>
    </section>

    {/* Row 3: Recommended Career Paths + Achievements */}
    <section
      className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
      aria-label="Career Paths and Achievements"
    >
      <div className="lg:col-span-2 h-full">
        <CareerPaths data={data.careerPaths} />
      </div>
      <div className="h-full">
        <Achievements data={data.achievements} />
      </div>
    </section>
  </div>
);
