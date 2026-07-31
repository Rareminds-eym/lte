import type React from "react";
import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation, useParams } from "react-router-dom";
import { useCapabilityLevels, useCourses } from "@/entities/course";
import { LearningPathInitializer } from "@/features/initialize-learning-path";
import { getLogger } from "@/shared";
import { ErrorFallback, SegmentedControl, toast } from "@/shared/ui";

import { buildDynamicLevelCards, mapApiLevelsToCards } from "../model/dynamicLevels";
import { CourseDetailSkeleton } from "./CourseDetailSkeleton";
import { CourseHeroBanner } from "./CourseHeroBanner";
import { CourseLevelCard } from "./CourseLevelCard";
import { CourseStatsOverlay } from "./CourseStatsOverlay";

const logger = getLogger("CourseDetailPage");

interface InitErrorState {
  initializationError: string;
}

const hasInitError = (state: unknown): state is InitErrorState => {
  return (
    typeof state === "object" &&
    state !== null &&
    "initializationError" in state &&
    typeof (state as { initializationError: unknown }).initializationError === "string"
  );
};

export const CourseDetailPage: React.FC = () => {
  const { capabilityCode } = useParams<{ capabilityCode: string }>();
  const location = useLocation();

  // Fetch remote user courses & capabilities state via TanStack Query
  const { data: courses, isPending, error } = useCourses();
  const { data: apiLevels } = useCapabilityLevels(capabilityCode ?? "");
  const [displayType, setDisplayType] = useState<"card" | "list">("card");

  const initError = hasInitError(location.state) ? location.state.initializationError : undefined;

  if (!capabilityCode) {
    return (
      <section role="alert" aria-live="assertive" className="p-8 text-danger-600 font-semibold">
        Invalid course URL.
      </section>
    );
  }

  // Find active course dynamically from API response
  const activeCourse =
    courses?.find(
      (c) =>
        c.capabilityCode.toLowerCase() === capabilityCode.toLowerCase() ||
        c.capabilityId === capabilityCode ||
        c.id === capabilityCode,
    ) ??
    courses?.[0] ??
    null;

  // Dynamically computed metadata from API course object or URL parameter
  const title = activeCourse?.title ?? "Observability: Logging, Monitoring & Debugging";
  const description =
    activeCourse?.description ??
    "Build guided capability to verify system health through logs, metrics, and traces — moving from guided log reading to independent observability architecture, without crossing role authority.";

  const roleTitle = activeCourse?.priority
    ? `${activeCourse.priority} ENGINEER`
    : "BACKEND ENGINEER";
  const heroCode = activeCourse?.badge ?? activeCourse?.capabilityCode ?? "OBS-L2";

  const statusLabel =
    activeCourse?.status === "completed"
      ? "Completed"
      : activeCourse?.status === "in_progress"
        ? "In Progress"
        : "Not Started";

  const durationHours = activeCourse?.durationHours || 225;
  const totalDurationStr = `${durationHours} hrs`;

  const xpValue = activeCourse?.xp || 1850;
  const xpAvailableStr = `${xpValue.toLocaleString()} XP`;

  const totalLevels = activeCourse?.totalLevels || 5;
  const currentUnlockedLevel = activeCourse?.currentLevel || 2;
  const targetLevelStr = activeCourse?.targetLevel || "L3";

  const parsedTargetLevelNum = parseInt(targetLevelStr.match(/\d+/)?.[0] ?? "3", 10);

  // Dynamically compute level cards: real API levels when available,
  // generated templates otherwise
  // ponytail: levels table is sparsely seeded (1 draft row) — delete
  // buildDynamicLevelCards + this fallback once levels exist for all capabilities
  const dynamicLevelCards =
    apiLevels && apiLevels.length > 0
      ? mapApiLevelsToCards(apiLevels, currentUnlockedLevel, parsedTargetLevelNum)
      : buildDynamicLevelCards(
          capabilityCode,
          title,
          currentUnlockedLevel,
          parsedTargetLevelNum,
          totalLevels,
        );

  const handleLevelAction = (levelNumber: number, levelTitle: string, status: string) => {
    if (status === "completed") {
      toast.success(`Reviewing Level ${levelNumber}: ${levelTitle}`);
    } else if (status === "unlocked") {
      toast.success(`Continuing Level ${levelNumber}: ${levelTitle}`);
    }
  };

  // Page Content Loading Skeleton (complies with restricted loading states rule)
  if (isPending) {
    return <CourseDetailSkeleton />;
  }

  // Error State Handling
  if (error) {
    logger.error(
      "Failed to load course details",
      error instanceof Error ? error : new Error("unknown"),
    );
    return (
      <main className="max-w-4xl mx-auto py-16 px-4 text-center" role="alert">
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-danger-700 mb-2">Failed to load course details</h2>
          <p className="text-sm text-danger-600">{error.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-secondary pb-16" data-testid="course-detail-page">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <LearningPathInitializer capabilityCode={capabilityCode} />
        </ErrorBoundary>

        {/* Visually hidden heading for accessibility */}
        <h1 className="sr-only">
          Course Details - {title} ({capabilityCode})
        </h1>

        {initError && (
          <section
            role="alert"
            aria-live="assertive"
            className="mb-6 p-4 bg-danger-50 text-danger-700 rounded-xl border border-danger-200"
            data-testid="init-error-message"
          >
            <p className="font-semibold text-sm">Initialization Error:</p>
            <p className="text-xs mt-1">{initError}</p>
          </section>
        )}

        {/* Hero Banner Section */}
        <CourseHeroBanner
          code={heroCode}
          status={statusLabel}
          roleTitle={roleTitle}
          capabilityCode={capabilityCode}
          title={title}
          description={description}
        />

        {/* Dynamic Stats Overlay Card */}
        <CourseStatsOverlay
          totalDuration={totalDurationStr}
          xpAvailable={xpAvailableStr}
          unlockedLevels={currentUnlockedLevel}
          totalLevels={totalLevels}
          targetLevel={targetLevelStr}
        />

        {/* Course Levels Section */}
        <section className="mt-10 sm:mt-12 w-full">
          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-content-primary">Course Levels</h2>
              <p className="text-xs sm:text-sm text-content-secondary mt-1">
                Complete each level to unlock the next. Your target proficiency for this role is
                Level {parsedTargetLevelNum}.
              </p>
            </div>

            {/* Display Type Toggle */}
            <SegmentedControl
              value={displayType}
              onChange={(v) => setDisplayType(v as "card" | "list")}
              ariaLabel="Display type"
              options={[
                {
                  value: "card",
                  label: "Cards",
                  icon: (
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
                      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
                      <rect x="14" y="14" width="6.5" height="6.5" rx="1.5" />
                      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
                    </svg>
                  ),
                },
                {
                  value: "list",
                  label: "List",
                  icon: (
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="9" y1="6" x2="20" y2="6" />
                      <line x1="9" y1="12" x2="20" y2="12" />
                      <line x1="9" y1="18" x2="20" y2="18" />
                      <circle cx="4.5" cy="6" r="1" fill="currentColor" />
                      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
                      <circle cx="4.5" cy="18" r="1" fill="currentColor" />
                    </svg>
                  ),
                },
              ]}
            />
          </div>

          {/* Level Cards */}
          <div
            className={
              displayType === "card"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-2"
            }
          >
            {dynamicLevelCards.map((level, idx) => (
              <CourseLevelCard
                key={level.code}
                {...level}
                variant={displayType}
                onAction={() => handleLevelAction(level.levelNumber, level.title, level.status)}
                isLast={idx === dynamicLevelCards.length - 1}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};
