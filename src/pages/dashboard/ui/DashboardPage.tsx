import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect } from "react";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { DASHBOARD_QUERY_KEY, useDashboardData } from "@/entities/dashboard";
import { useReadiness } from "@/entities/dashboard/api/dashboardApi";
import { useAuthStore } from "@/entities/session";
import { getLogger } from "@/shared";
import { apiFetch } from "@/shared/api";
import { useXpModalStore } from "@/shared/store";
import { Button } from "@/shared/ui";
import { DashboardContent } from "@/widgets/dashboard";
import { LearningPathEmptyState } from "@/widgets/learning-path";
import { DashboardSkeleton } from "./DashboardSkeleton";

const logger = getLogger("DashboardPage");

export const DashboardPage: React.FC = () => {
  const { data, isPending, isError, refetch } = useDashboardData();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const activeTrack = useLearningPathStore((s) => s.activeTrack);
  const needsAssessment = useLearningPathStore((s) => s.needsAssessment);
  const activeLearningPathLoading = useLearningPathStore((s) => s.activeLearningPathLoading);

  const addEvent = useXpModalStore((s) => s.addEvent);
  const shownEventIds = useXpModalStore((s) => s.shownEventIds);

  useEffect(() => {
    const getXpCategory = (eventType: string): "evidence" | "engagement" => {
      const evidenceEvents = [
        "stage_completed",
        "practice_artifact_accepted",
        "practice_artifact_failed",
        "final_artifact_accepted_1",
        "final_artifact_accepted_2",
        "final_artifact_accepted_3",
        "final_artifact_failed",
        "manual_eval_accepted",
        "fallback_eval_failed",
        "course_completed_on_time",
        "fast_track_capability",
        "capstone_completed",
      ];
      return evidenceEvents.includes(eventType) ? "evidence" : "engagement";
    };

    if (data?.todayEvents && data.todayEvents.length > 0) {
      data.todayEvents.forEach((event) => {
        if (!shownEventIds.has(event.id)) {
          addEvent({
            id: event.id,
            xpAmount: event.xp_amount,
            totalXp: data.careerTarget.xp ?? 0,
            eventType: event.event_type,
            xpCategory: getXpCategory(event.event_type),
            onClose: async () => {
              try {
                // Mark as shown in database
                await apiFetch("/api/v1/dashboard/xp", {
                  method: "POST",
                  body: JSON.stringify({ eventIds: [event.id] }),
                });

                // Then invalidate query cache
                if (userId) {
                  queryClient.invalidateQueries({
                    queryKey: [...DASHBOARD_QUERY_KEY, userId],
                  });
                }
              } catch (error) {
                logger.error(
                  "Failed to mark event as shown:",
                  error instanceof Error ? error : new Error(String(error)),
                );
              }
            },
          });
        }
      });
    }
  }, [data?.todayEvents, data?.careerTarget.xp, addEvent, shownEventIds, queryClient, userId]);

  // Readiness: must be called before any early return (rules of hooks)
  const { data: readiness } = useReadiness(
    userId,
    !needsAssessment && !!data && !isPending && !isError,
  );

  // Loading state: use the structured DashboardSkeleton to prevent layout shift on initial load only
  if ((isPending && !data) || (activeLearningPathLoading && !data)) {
    return <DashboardSkeleton />;
  }

  if (isError && !data) {
    return (
      <div
        className="p-8 text-center bg-surface-primary rounded-2xl border border-line-default max-w-lg mx-auto my-12 shadow-sm"
        role="alert"
      >
        <h2 className="text-lg font-bold text-content-primary mb-2">Unable to load Dashboard</h2>
        <p className="text-xs text-content-secondary mb-4">
          There was an error loading your dashboard metrics. Please try again.
        </p>
        <div className="flex justify-center">
          <Button type="button" size="sm" variant="primary" onClick={() => void refetch()}>
            Retry Loading Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (needsAssessment) {
    return <LearningPathEmptyState />;
  }

  // Merge the real active track details and list of tracks from store if available
  const firstRole = activeTrack?.roles?.[0];
  const mergedData =
    data && activeTrack
      ? {
          ...data,
          careerTarget: {
            ...data.careerTarget,
            title: firstRole?.roleName || activeTrack.track,
            readinessPercentage:
              readiness?.score ?? firstRole?.readinessScore ?? activeTrack.matchScore,
            domain: firstRole?.domain || data.careerTarget.domain,
            industry:
              typeof firstRole?.metadata?.["industry"] === "string"
                ? firstRole.metadata["industry"]
                : data.careerTarget.industry,
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
    <div className="space-y-6">
      <DashboardContent data={mergedData || data} />
      {readiness && (
        <section
          aria-label="Readiness report"
          className="rounded-2xl border border-line-default bg-surface-primary p-6 shadow-xs max-w-[1440px] mx-auto"
        >
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm font-bold text-content-primary">
              Readiness: {readiness.score}% — {readiness.band}
            </div>
            {readiness.currentRole && (
              <div className="text-xs font-medium text-content-secondary">
                Role: {readiness.currentRole?.name ?? "—"}
              </div>
            )}
            {readiness.lastCalculated && (
              <div className="text-xs text-content-muted">
                Last calculated: {new Date(readiness.lastCalculated).toLocaleDateString()}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(readiness.components).map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-3 py-1 font-medium text-content-secondary"
                >
                  {k}: {v.value}% <span className="text-content-muted">· w{v.weight}</span>
                </span>
              ))}
            </div>
          </div>
          {readiness.missingEvidence?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-content-secondary">
                Missing evidence (top 3)
              </div>
              <ul className="mt-1 list-disc pl-5 text-xs text-content-body">
                {readiness.missingEvidence.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {readiness.configWarnings?.length > 0 && (
            <div className="mt-3 text-xs text-warning-600">
              {readiness.configWarnings.map((w) => (
                <div key={w}>⚠ {w}</div>
              ))}
            </div>
          )}
          {readiness.improvementActions && readiness.improvementActions.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-content-secondary">Next steps</div>
              <ul className="mt-1 list-disc pl-5 text-xs text-content-body">
                {readiness.improvementActions.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
