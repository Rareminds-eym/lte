import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLearningPath } from "@/entities/active-learning-path";
import { CourseCard, useCourses } from "@/entities/course";
import { useAuthStore } from "@/entities/session";
import { LearningPathInitializer } from "@/features/initialize-learning-path";
import { StartAssessmentButton } from "@/features/start-assessment";
import { getLogger } from "@/shared";
import { UI_TEXT } from "@/shared/config";
import { cn } from "@/shared/lib";
import { SearchQuerySchema } from "@/shared/schemas";
import { Button, SegmentedControl } from "@/shared/ui";
import {
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  DashboardGridIcon,
  FilterIcon,
  LayersIcon,
  ListIcon,
} from "@/shared/ui/icons";
import { Pagination } from "@/widgets";
import { LearningPathEmptyState } from "@/widgets/learning-path";
import {
  COURSE_PAGE_SIZE,
  filterCoursesBySearch,
  getSafeCoursePage,
  paginateCourses,
} from "../model/courseFilters";
import { CoursesPageSkeleton } from "./CoursesPageSkeleton";

const STATS_PILL_STYLES = {
  enrolled: "bg-brand-50 border-brand-100 text-brand-700 [&_svg]:text-brand-500",
  completed: "bg-success-50 border-success-200 text-success-700 [&_svg]:text-success-600",
  inProgress: "bg-warning-50 border-warning-200 text-warning-700 [&_svg]:text-warning-600",
} as const;

export const CoursesPage = () => {
  const [activeRoleFilter, setActiveRoleFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedSearch = SearchQuerySchema.safeParse(searchParams.get("q") ?? "");
  const searchQuery = parsedSearch.success ? parsedSearch.data : "";
  const [pagination, setPagination] = useState({ query: searchQuery, page: 1 });
  const currentPage = pagination.query === searchQuery ? pagination.page : 1;
  const setCurrentPage = (page: number) => setPagination({ query: searchQuery, page });

  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const authInitialized = useAuthStore((s) => s.initialized);
  const userId = user?.id;
  const needsAssessment = useLearningPath((s) => s.needsAssessment);

  const hasInitParams = Boolean(searchParams.get("trackId"));

  const { data: courses, isPending, error, refetch } = useCourses(userId ?? undefined);

  const isCoursesLoading =
    !courses && ((Boolean(userId) && isPending) || (authLoading && !authInitialized));

  const rolesMap = new Map<string, string>();
  for (const c of courses ?? []) {
    if (c.roleId && c.roleName) {
      rolesMap.set(c.roleId, c.roleName);
    }
  }
  const uniqueRoles = Array.from(rolesMap.entries()).map(([id, name]) => ({ id, name }));

  const roleTabs = [
    { id: null as string | null, label: UI_TEXT.allRoles },
    ...uniqueRoles.map((r) => ({ id: r.id, label: r.name })),
  ];

  const filteredCourses = filterCoursesBySearch(courses ?? [], searchQuery, activeRoleFilter);

  const totalPages = Math.ceil(filteredCourses.length / COURSE_PAGE_SIZE);
  const safePage = getSafeCoursePage(currentPage, totalPages);
  const paginatedCourses = paginateCourses(filteredCourses, safePage);

  const total = courses?.length ?? 0;
  const completed = courses?.filter((c) => c.status === "completed").length ?? 0;
  const inProgress = courses?.filter((c) => c.status === "in_progress").length ?? 0;

  const roleCounts: Record<string, number> = {};
  for (const c of courses ?? []) {
    if (c.roleId) {
      roleCounts[c.roleId] = (roleCounts[c.roleId] ?? 0) + 1;
    }
  }

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
          <p className="text-base font-bold text-danger-700">{UI_TEXT.failedToLoadCourses}</p>
          <p className="text-xs text-danger-600 mt-1">{error.message}</p>
          <div className="mt-4 flex justify-center">
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              {UI_TEXT.retryLoadingCourses}
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
              <BookOpenIcon size={20} className="text-accent-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-content-primary">{UI_TEXT.noLearningPathYet}</h2>
            <p className="text-sm text-content-secondary">
              {needsAssessment ? UI_TEXT.assessmentDescription : UI_TEXT.noCourses}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-1">
              <BookOpenIcon size={20} className="text-accent-purple-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-content-primary leading-tight">
                {UI_TEXT.coursesHeading}
              </h1>
              <p className="text-sm text-content-secondary mt-0.5">{UI_TEXT.coursesDescription}</p>
            </div>
          </div>

          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:shrink-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
            <StatsPill
              icon={<LayersIcon size={14} />}
              count={total}
              label={UI_TEXT.enrolled}
              className={STATS_PILL_STYLES.enrolled}
            />
            <StatsPill
              icon={<CheckIcon size={14} />}
              count={completed}
              label={UI_TEXT.completed}
              className={STATS_PILL_STYLES.completed}
            />
            <StatsPill
              icon={<ClockIcon size={14} />}
              count={inProgress}
              label={UI_TEXT.inProgress}
              className={STATS_PILL_STYLES.inProgress}
            />
          </div>
        </div>
      </header>

      {/* Role Tabs */}
      {searchQuery && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-default bg-surface-primary p-4 text-sm text-content-secondary"
        >
          <p>
            {UI_TEXT.searchResults(filteredCourses.length)}{" "}
            <span className="font-semibold text-content-primary">
              {UI_TEXT.quotedSearch(searchQuery)}
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("q");
              setSearchParams(next);
              setCurrentPage(1);
            }}
          >
            {UI_TEXT.clearSearch}
          </Button>
        </div>
      )}
      {uniqueRoles.length > 0 && (
        <div
          role="tablist"
          aria-label={UI_TEXT.filterByRole}
          className="flex items-center gap-4 overflow-x-auto border-b border-line-default scrollbar-none sm:gap-6"
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
                  "relative shrink-0 pb-3 text-sm font-medium transition-colors cursor-pointer",
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          icon={<FilterIcon size={16} />}
          className="rounded-full"
        >
          {UI_TEXT.filter}
        </Button>

        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm text-content-secondary font-medium">
            {filteredCourses.length} {UI_TEXT.courses}
          </span>
          <SegmentedControl
            value={viewMode}
            onChange={(v) => setViewMode(v as "grid" | "list")}
            ariaLabel={UI_TEXT.displayType}
            options={[
              {
                value: "grid",
                label: UI_TEXT.gridView,
                icon: <DashboardGridIcon size={16} />,
              },
              {
                value: "list",
                label: UI_TEXT.listView,
                icon: <ListIcon size={16} />,
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
          {searchQuery ? UI_TEXT.noSearchResults : UI_TEXT.noCoursesOnPage}
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
      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-full border text-sm font-medium [&_svg]:block [&_svg]:shrink-0",
      className,
    )}
  >
    {icon}
    <span className="leading-none">
      {count} {label}
    </span>
  </span>
);
