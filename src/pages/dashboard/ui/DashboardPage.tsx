import type React from "react";
import { useMemo, useState } from "react";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { useDashboardData } from "@/entities/dashboard";
import { XpRewardModal } from "@/features/xp-reward";
import { DashboardContent } from "@/widgets/dashboard";
import { LearningPathEmptyState } from "@/widgets/learning-path";
import { DashboardSkeleton } from "./DashboardSkeleton";

export const DashboardPage: React.FC = () => {
  const { data, isPending, isError } = useDashboardData();
  const activeTrack = useLearningPathStore((s) => s.activeTrack);
  const needsAssessment = useLearningPathStore((s) => s.needsAssessment);
  const activeLearningPathLoading = useLearningPathStore((s) => s.activeLearningPathLoading);

  const [dismissedEventIds, setDismissedEventIds] = useState<string[]>([]);

  const currentShowEvent = useMemo(() => {
    if (!data?.todayEvents || data.todayEvents.length === 0) return null;
    try {
      const shownIdsRaw = localStorage.getItem("lte-shown-xp-event-ids");
      const parsed = shownIdsRaw ? JSON.parse(shownIdsRaw) : [];
      const shownIds: string[] = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
      return (
        data.todayEvents.find(
          (event) => !shownIds.includes(event.id) && !dismissedEventIds.includes(event.id),
        ) || null
      );
    } catch {
      return null;
    }
  }, [data?.todayEvents, dismissedEventIds]);

  const handleCloseXpModal = () => {
    if (currentShowEvent) {
      try {
        const shownIdsRaw = localStorage.getItem("lte-shown-xp-event-ids");
        const parsed = shownIdsRaw ? JSON.parse(shownIdsRaw) : [];
        const shownIds: string[] = Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : [];
        if (!shownIds.includes(currentShowEvent.id)) {
          shownIds.push(currentShowEvent.id);
          localStorage.setItem("lte-shown-xp-event-ids", JSON.stringify(shownIds));
        }
      } catch {
        // Ignore error
      }
      setDismissedEventIds((prev) => [...prev, currentShowEvent.id]);
    }
  };

  // Loading state: use the structured DashboardSkeleton to prevent layout shift on initial load only
  if ((isPending && !data) || (activeLearningPathLoading && !data)) {
    return <DashboardSkeleton />;
  }

  if (needsAssessment) {
    return <LearningPathEmptyState />;
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

  // Merge the real active track details and list of tracks from store if available
  const mergedData =
    data && activeTrack
      ? {
          ...data,
          careerTarget: {
            ...data.careerTarget,
            title: activeTrack.roles?.[0]?.roleName || activeTrack.track,
            readinessPercentage:
              activeTrack.roles?.[0]?.readinessScore !== undefined
                ? activeTrack.roles[0].readinessScore
                : activeTrack.matchScore,
          },
          careerPaths: {
            ...data.careerPaths,
            activeTrackTitle: activeTrack.track,
            matchPercentage: activeTrack.matchScore,
            whyItFits: activeTrack.whyItFits || data.careerPaths.whyItFits,
            tracks:
              activeTrack.tracks && activeTrack.tracks.length > 0
                ? (activeTrack.tracks as unknown as import("@/entities/dashboard").CareerTrackItem[])
                : data.careerPaths.tracks,
            capabilitiesCount: activeTrack.roles
              ? activeTrack.roles.length
              : data.careerPaths.capabilitiesCount,
            overallProgress:
              activeTrack.overallProgress !== undefined
                ? activeTrack.overallProgress
                : data.careerPaths.overallProgress,
            competitionCount:
              activeTrack.completionCount !== undefined
                ? activeTrack.completionCount
                : data.careerPaths.competitionCount,
          },
        }
      : data;

  return (
    <>
      <DashboardContent data={mergedData || data} />
      {currentShowEvent && (
        <XpRewardModal
          isOpen={true}
          xpAmount={currentShowEvent.xp_amount}
          totalXp={data?.careerTarget.xp ?? 0}
          stageName={currentShowEvent.event_type}
          onClose={handleCloseXpModal}
          xpCategory="engagement"
        />
      )}
    </>
  );
};
