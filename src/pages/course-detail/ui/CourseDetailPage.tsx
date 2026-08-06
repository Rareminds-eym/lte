import type React from "react";
import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { CourseCardGridSkeleton, useCapabilityLevels, useCourses } from "@/entities/course";
import { useAuthStore } from "@/entities/session";
import { LearningPathInitializer } from "@/features/initialize-learning-path";
import { getLogger } from "@/shared";
import { Button, ErrorFallback, SegmentedControl, toast } from "@/shared/ui";

import { mapApiLevelsToCards } from "../model/dynamicLevels";
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
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const authInitialized = useAuthStore((s) => s.initialized);
  const userId = user?.id;

  // Fetch remote user courses & capabilities state via TanStack Query
  const { data: courses, isPending, error } = useCourses(userId ?? undefined);
  const {
    data: apiLevels,
    isPending: isLevelsPending,
    isError: isLevelsError,
    error: levelsError,
    refetch: refetchLevels,
  } = useCapabilityLevels(capabilityCode ?? "");
  // Track whether the learning path is still being loaded/created.
  // During the SkillPassport → LTE transition the LP may not exist yet;
  // the levels query is gated on it, so show a skeleton while it settles.
  const learningPathLoading = useLearningPathStore((s) => s.activeLearningPathLoading);
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
    ) ?? null;

  // Metadata strictly coming from active course DB object
  const title = activeCourse?.title ?? activeCourse?.capabilityCode ?? capabilityCode;
  const description = activeCourse?.description ?? "";

  const roleTitle = activeCourse?.priority ? `${activeCourse.priority} ENGINEER` : "";
  const heroCode = activeCourse?.badge ?? activeCourse?.capabilityCode ?? capabilityCode;

  const statusLabel =
    activeCourse?.status === "completed"
      ? "Completed"
      : activeCourse?.status === "in_progress"
        ? "In Progress"
        : "Not Started";

  const totalDurationMinutes =
    apiLevels?.reduce((sum, lvl) => sum + (lvl.durationMinutes || 0), 0) ?? 0;
  const durationHours =
    activeCourse?.durationHours ||
    (totalDurationMinutes > 0 ? Math.round(totalDurationMinutes / 60) : 0);
  const totalDurationStr = durationHours > 0 ? `${durationHours} hrs` : "N/A";

  const totalLevelXp = apiLevels?.reduce((sum, lvl) => sum + (lvl.totalXp || 0), 0) ?? 0;
  const xpValue = activeCourse?.xp || totalLevelXp;
  const xpAvailableStr = xpValue > 0 ? `${xpValue.toLocaleString()} XP` : "0 XP";

  const totalLevels = activeCourse?.totalLevels || apiLevels?.length || 0;
  const currentUnlockedLevel = activeCourse?.currentLevel || 1;
  const targetLevelStr = activeCourse?.targetLevel || "L1";

  const parsedTargetLevelNum = parseInt(targetLevelStr.match(/\d+/)?.[0] ?? "1", 10);

  // Strictly map real DB levels
  const dynamicLevelCards = mapApiLevelsToCards(
    apiLevels ?? [],
    currentUnlockedLevel,
    parsedTargetLevelNum,
  );

  const handleLevelAction = (levelId?: string, status?: string) => {
    if (status === "locked") {
      toast.error("This level is locked. Complete the previous level first.");
      return;
    }
    if (capabilityCode && levelId) {
      navigate(
        `/courses/${encodeURIComponent(capabilityCode)}/levels/${encodeURIComponent(levelId)}`,
      );
    } else {
      toast.error("Unable to navigate to level modules: level ID is missing.");
    }
  };

  const isCoursesLoading =
    !courses && ((Boolean(userId) && isPending) || (authLoading && !authInitialized));

  // Page Content Loading Skeleton (complies with restricted loading states rule)
  if (isCoursesLoading) {
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

          {/* Level Cards Section Content with Loading, Error, Retry, and Empty States */}
          {isLevelsPending || learningPathLoading ? (
            <CourseCardGridSkeleton count={3} />
          ) : isLevelsError ? (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-2xl border border-danger-200 bg-danger-50 p-8 text-center shadow-xs"
            >
              <p className="text-base font-bold text-danger-700">Failed to load course levels</p>
              <p className="mt-1 text-xs text-danger-600">
                {levelsError instanceof Error ? levelsError.message : "Network or server error"}
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void refetchLevels()}
                >
                  Retry Loading Levels
                </Button>
              </div>
            </div>
          ) : dynamicLevelCards.length === 0 ? (
            <div className="text-center py-12 text-content-secondary bg-surface-primary rounded-2xl border border-line-default">
              No published levels found for this capability in the database.
            </div>
          ) : (
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
                  onAction={() => handleLevelAction(level.id, level.status)}
                  isLast={idx === dynamicLevelCards.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
