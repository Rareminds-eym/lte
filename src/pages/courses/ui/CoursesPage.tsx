import { useState } from "react";
import { CourseCard, CourseCardGridSkeleton, useCourses } from "@/entities/course";
import { useAuthStore } from "@/entities/session";
import { getLogger } from "@/shared";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { Pagination } from "@/widgets";
import {
  COURSE_PAGE_SIZE,
  filterCoursesByPriority,
  getSafeCoursePage,
  paginateCourses,
} from "../model/courseFilters";

const PRIORITIES = ["Core", "Important", "Supporting"] as const;
type Priority = (typeof PRIORITIES)[number];

const PRIORITY_TABS = [
  { id: null as Priority | null, label: "All" },
  ...PRIORITIES.map((p) => ({ id: p as Priority, label: p })),
];

const STATS_PILL_STYLES = {
  enrolled: "bg-brand-50 border-brand-100 text-brand-700 [&_svg]:text-brand-500",
  completed: "bg-success-50 border-success-200 text-success-700 [&_svg]:text-success-600",
  inProgress: "bg-warning-50 border-warning-200 text-warning-700 [&_svg]:text-warning-600",
} as const;

export const CoursesPage = () => {
  const [activePriority, setActivePriority] = useState<Priority | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const userId = useAuthStore((s) => s.user?.id);
  const { data: courses, isPending, error } = useCourses(userId);

  const filteredCourses = filterCoursesByPriority(courses ?? [], activePriority);
  const totalPages = Math.ceil(filteredCourses.length / COURSE_PAGE_SIZE);
  const safePage = getSafeCoursePage(currentPage, totalPages);
  const paginatedCourses = paginateCourses(filteredCourses, safePage);

  const total = courses?.length ?? 0;
  const completed = courses?.filter((c) => c.status === "completed").length ?? 0;
  const inProgress = courses?.filter((c) => c.status === "in_progress").length ?? 0;

  const priorityCounts: Record<string, number> = {};
  if (courses) {
    for (const p of PRIORITIES) {
      priorityCounts[p] = courses.filter((c) => c.priority === p).length;
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6">
        <header className="flex items-start justify-between gap-6 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-muted shrink-0 mt-1" />
            <div className="space-y-2">
              <div className="h-6 w-32 bg-surface-muted rounded" />
              <div className="h-4 w-64 bg-surface-muted rounded" />
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-24 h-10 bg-surface-muted rounded-full" />
            <div className="w-24 h-10 bg-surface-muted rounded-full" />
            <div className="w-24 h-10 bg-surface-muted rounded-full" />
          </div>
        </header>
        <div className="h-px bg-line-default w-full" />
        <CourseCardGridSkeleton />
      </div>
    );
  }

  if (error) {
    getLogger("CoursesPage").error(
      "Failed to load courses",
      error instanceof Error ? error : new Error("unknown"),
    );
    return (
      <div className="mx-auto max-w-[1440px] py-16 text-center" role="alert">
        <p className="text-danger-600 font-semibold">Failed to load courses.</p>
        <p className="text-sm text-content-secondary mt-1">{error.message}</p>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-6">
        <div className="text-center py-16 text-content-secondary">
          No courses found. Complete an assessment to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
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

      <div
        role="tablist"
        aria-label="Course priority"
        className="flex items-center gap-6 border-b border-line-default"
      >
        {PRIORITY_TABS.map((tab) => {
          const count = tab.id === null ? total : (priorityCounts[tab.id] ?? 0);
          const isActive = activePriority === tab.id;
          return (
            <button
              key={tab.label}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => {
                setActivePriority(tab.id);
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

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" icon={<FilterIcon />} className="rounded-full">
          Filter
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-content-secondary font-medium">
            {filteredCourses.length} courses
          </span>
          <div className="flex items-center border border-line-default rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className={cn(
                "p-1.5 transition-colors cursor-pointer",
                viewMode === "grid"
                  ? "bg-surface-muted text-content-primary"
                  : "text-content-muted hover:text-content-secondary",
              )}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={cn(
                "p-1.5 transition-colors cursor-pointer",
                viewMode === "list"
                  ? "bg-surface-muted text-content-primary"
                  : "text-content-muted hover:text-content-secondary",
              )}
            >
              <ListIcon />
            </button>
          </div>
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
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const ListIcon: React.FC = () => (
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
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
