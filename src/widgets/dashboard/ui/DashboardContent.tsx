import type React from "react";
import type { DashboardData } from "@/entities/dashboard";
import { Achievements } from "@/widgets/dashboard/Achievements";
import { CapabilityGapMap } from "@/widgets/dashboard/CapabilityGapMap";
import { CareerPaths } from "@/widgets/dashboard/CareerPaths";
import { CareerTargetBanner } from "@/widgets/dashboard/CareerTargetBanner";
import { JourneyHero } from "@/widgets/dashboard/JourneyHero";
import { TodaysPriorities } from "@/widgets/dashboard/TodaysPriorities";
import { UpcomingFeedback } from "@/widgets/dashboard/UpcomingFeedback";

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
        <JourneyHero data={data.journey} />
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
