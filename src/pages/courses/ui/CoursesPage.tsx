import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { CourseCard, useCourses } from "@/entities/course";
import { useAuthStore } from "@/entities/session";
import { LearningPathInitializer } from "@/features/initialize-learning-path";
import { StartAssessmentButton } from "@/features/start-assessment";
import { getLogger } from "@/shared";
import { cn } from "@/shared/lib";
import { Button, SegmentedControl } from "@/shared/ui";
import { Pagination } from "@/widgets";
import { LearningPathEmptyState } from "@/widgets/learning-path";
import { COURSE_PAGE_SIZE, getSafeCoursePage, paginateCourses } from "../model/courseFilters";
import { CoursesPageSkeleton } from "./CoursesPageSkeleton";

const STATS_PILL_STYLES = {
  enrolled: "bg-brand-50 border-brand-100 text-brand-700 [&_svg]:text-brand-500",
  completed: "bg-success-50 border-success-200 text-success-700 [&_svg]:text-success-600",
  inProgress: "bg-warning-50 border-warning-200 text-warning-700 [&_svg]:text-warning-600",
} as const;

export const CoursesPage = () => {
  const [activeRoleFilter, setActiveRoleFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchParams] = useSearchParams();

  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const authInitialized = useAuthStore((s) => s.initialized);
  const userId = user?.id;
  const needsAssessment = useLearningPathStore((s) => s.needsAssessment);

  const hasInitParams = Boolean(searchParams.get("trackId"));

  const { data: courses, isPending, error, refetch } = useCourses(userId ?? undefined);

  const isCoursesLoading =
    !courses && ((Boolean(userId) && isPending) || (authLoading && !authInitialized));

  const uniqueRoles = useMemo(() => {
    if (!courses) return [];
    const rolesMap = new Map<string, string>();
    for (const c of courses) {
      if (c.roleId && c.roleName) {
        rolesMap.set(c.roleId, c.roleName);
      }
    }
    return Array.from(rolesMap.entries()).map(([id, name]) => ({ id, name }));
  }, [courses]);

  const roleTabs = useMemo(() => {
    return [
      { id: null as string | null, label: "All Roles" },
      ...uniqueRoles.map((r) => ({ id: r.id, label: r.name })),
    ];
  }, [uniqueRoles]);

  const filteredCourses = useMemo(() => {
    let result = courses ?? [];
    if (activeRoleFilter) {
      result = result.filter((c) => c.roleId === activeRoleFilter);
    }
    return result;
  }, [courses, activeRoleFilter]);

  const totalPages = Math.ceil(filteredCourses.length / COURSE_PAGE_SIZE);
  const safePage = getSafeCoursePage(currentPage, totalPages);
  const paginatedCourses = paginateCourses(filteredCourses, safePage);

  const total = courses?.length ?? 0;
  const completed = courses?.filter((c) => c.status === "completed").length ?? 0;
  const inProgress = courses?.filter((c) => c.status === "in_progress").length ?? 0;

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (courses) {
      for (const c of courses) {
        if (c.roleId) {
          counts[c.roleId] = (counts[c.roleId] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [courses]);

  if (isCoursesLoading) {
    return <CoursesPageSkeleton />;
  }

  if (needsAssessment && !hasInitParams) {
    return <LearningPathEmptyState />;
  }

  if (error) {
    getLogger("CoursesPage").error(
      "Failed to load courses",
      error instanceof Error ? error : new Error("unknown"),
    );
    return (
      <div className="mx-auto max-w-[1440px] py-16 text-center" role="alert">
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-8 shadow-xs max-w-md mx-auto">
          <p className="text-base font-bold text-danger-700">Failed to load courses</p>
          <p className="text-xs text-danger-600 mt-1">{error.message}</p>
          <div className="mt-4 flex justify-center">
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              Retry Loading Courses
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6">
        <LearningPathInitializer />
        <div className="py-16 text-center">
          <div className="mx-auto max-w-md space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center">
              <BookIcon />
            </div>
            <h2 className="text-xl font-bold text-content-primary">No learning path yet</h2>
            <p className="text-sm text-content-secondary">
              {needsAssessment
                ? "Take a quick assessment to get your personalized learning track and unlock your courses."
                : "No courses found. Please check back later."}
            </p>
            {needsAssessment && (
              <div className="pt-2">
                <StartAssessmentButton />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <LearningPathInitializer />
      <header>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-1">
              <BookIcon />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-content-primary leading-tight">My Courses</h1>
              <p className="text-sm text-content-secondary mt-0.5">
                Track your enrolled courses and continue where you left off.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <StatsPill
              icon={<LayersIconSmall />}
              count={total}
              label="Enrolled"
              className={STATS_PILL_STYLES.enrolled}
            />
            <StatsPill
              icon={<CheckIconSmall />}
              count={completed}
              label="Completed"
              className={STATS_PILL_STYLES.completed}
            />
            <StatsPill
              icon={<ClockIconSmall />}
              count={inProgress}
              label="In Progress"
              className={STATS_PILL_STYLES.inProgress}
            />
          </div>
        </div>
      </header>

      {/* Role Tabs */}
      {uniqueRoles.length > 0 && (
        <div
          role="tablist"
          aria-label="Filter by role"
          className="flex items-center gap-6 border-b border-line-default"
        >
          {roleTabs.map((tab) => {
            const count = tab.id === null ? total : (roleCounts[tab.id] ?? 0);
            const isActive = activeRoleFilter === tab.id;
            return (
              <button
                key={tab.label}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => {
                  setActiveRoleFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={cn(
                  "relative pb-3 text-sm font-medium transition-colors cursor-pointer",
                  isActive ? "text-brand-600" : "text-content-secondary hover:text-content-primary",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[11px] font-semibold rounded-full",
                    isActive
                      ? "bg-brand-100 text-brand-600"
                      : "bg-surface-muted text-content-secondary",
                  )}
                >
                  {count}
                </span>
                {isActive && (
                  <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-brand-600 rounded-full z-10" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" icon={<FilterIcon />} className="rounded-full">
          Filter
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-content-secondary font-medium">
            {filteredCourses.length} courses
          </span>
          <SegmentedControl
            value={viewMode}
            onChange={(v) => setViewMode(v as "grid" | "list")}
            ariaLabel="Display type"
            options={[
              {
                value: "grid",
                label: "Grid view",
                icon: <GridIcon />,
              },
              {
                value: "list",
                label: "List view",
                icon: <ListIcon />,
              },
            ]}
          />
        </div>
      </div>

      {paginatedCourses.length > 0 ? (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "flex flex-col gap-4"
          }
        >
          {paginatedCourses.map((course) => (
            <CourseCard key={course.id} course={course} variant={viewMode} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-content-secondary">
          No courses found on this page.
        </div>
      )}

      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
};

const StatsPill: React.FC<{
  icon: React.ReactNode;
  count: number;
  label: string;
  className?: string;
}> = ({ icon, count, label, className }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-sm font-medium",
      className,
    )}
  >
    <span className="w-4 h-4">{icon}</span>
    <span>
      {count} {label}
    </span>
  </span>
);

const BookIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-5 h-5 text-accent-purple-600"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const LayersIconSmall: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 12 12 17 22 12" />
    <polyline points="2 17 12 22 22 17" />
  </svg>
);

const CheckIconSmall: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ClockIconSmall: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const FilterIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const GridIcon: React.FC = () => (
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
);

const ListIcon: React.FC = () => (
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
);
