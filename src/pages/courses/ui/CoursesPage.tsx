import { useMemo, useState } from "react";
import { type Course, CourseCard } from "@/entities/course";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import { Pagination } from "@/widgets";
import {
  COURSE_PAGE_SIZE,
  filterCoursesByRole,
  getSafeCoursePage,
  paginateCourses,
} from "../model/courseFilters";

// ponytail: mock data, replace with TanStack Query + entities/course/api/ when backend exists
const MOCK_COURSES: Course[] = [
  {
    id: "1",
    title: "Observability: Logging, Monitoring & Debugging",
    description:
      "Learn how to debug and monitor backend systems for better performance and stability.",
    category: "Backend Engineer",
    level: "Intermediate",
    role: "backend",
    status: "in_progress",
    progress: 20,
    currentLevel: 1,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 500,
    badge: "OBS-L2",
    imageUrl: "https://picsum.photos/seed/obs-logging/400/220",
    tags: ["Observability & Debugging", "Software Engineering", "Applied Skill"],
  },
  {
    id: "2",
    title: "React: Advanced Patterns & Performance Optimization",
    description:
      "Deep dive into scalable React patterns, code splitting, and performance optimization.",
    category: "Frontend Engineer",
    level: "Advanced",
    role: "frontend",
    status: "in_progress",
    progress: 20,
    currentLevel: 1,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 240,
    badge: "OBS-L2",
    imageUrl: "https://picsum.photos/seed/react-patterns/400/220",
    tags: ["Frontend Frameworks (React)", "Software Engineering", "Applied Skill"],
  },
  {
    id: "3",
    title: "API Design: REST, GraphQL & Scalability",
    description: "Design production-ready REST and GraphQL APIs following industry best practices.",
    category: "Backend Engineer",
    level: "Intermediate",
    role: "backend",
    status: "in_progress",
    progress: 60,
    currentLevel: 3,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 320,
    badge: "OBS-L2",
    imageUrl: "https://picsum.photos/seed/api-design/400/220",
    tags: ["API Design & Implementation", "Software Engineering", "Applied Skill"],
    qualified: true,
  },
  {
    id: "4",
    title: "Database Design: Schema & Query Optimization",
    description: "Design efficient database schemas and master query optimization techniques.",
    category: "Backend Engineer",
    level: "Intermediate",
    role: "backend",
    status: "in_progress",
    progress: 40,
    currentLevel: 2,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 250,
    badge: "OBS-L2",
    imageUrl: "https://picsum.photos/seed/db-design/400/220",
    tags: ["Security & Authentication", "Software Engineering", "Applied Skill"],
  },
  {
    id: "5",
    title: "Security: Authentication & Authorization Patterns",
    description: "Implement secure auth flows, JWT, OAuth2, and RBAC in backend services.",
    category: "Backend Engineer",
    level: "Intermediate",
    role: "backend",
    status: "not_started",
    progress: 0,
    currentLevel: 0,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 500,
    badge: "OBS-L2",
    imageUrl: "https://picsum.photos/seed/security-auth/400/220",
    tags: ["Observability & Debugging", "Software Engineering", "Applied Skill"],
  },
  {
    id: "6",
    title: "DevOps Fundamentals: CI/CD & Deployment",
    description:
      "Build deployment pipelines and ship applications reliably to production environments.",
    category: "Backend Engineer",
    level: "Intermediate",
    role: "backend",
    status: "completed",
    progress: 100,
    currentLevel: 5,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 300,
    badge: "OBS-L2",
    imageUrl: "https://picsum.photos/seed/devops-cicd/400/220",
    tags: ["Observability & Debugging", "Software Engineering", "Applied Skill"],
    qualified: true,
  },
  {
    id: "7",
    title: "TypeScript Advanced Patterns",
    description:
      "Master advanced TypeScript features including conditional types, template literals, and mapped types for real-world codebases.",
    category: "Frontend Engineer",
    level: "Advanced",
    role: "frontend",
    status: "completed",
    progress: 100,
    currentLevel: 5,
    totalLevels: 5,
    targetLevel: "L4",
    durationHours: 40,
    xp: 550,
    imageUrl: "https://picsum.photos/seed/course-7/400/220",
    tags: ["TypeScript", "Patterns", "Engineering"],
    qualified: true,
  },
  {
    id: "8",
    title: "Modern CSS Architecture",
    description:
      "Learn modern CSS techniques including container queries, cascade layers, and utility-first design workflows.",
    category: "Frontend Engineer",
    level: "Intermediate",
    role: "frontend",
    status: "not_started",
    progress: 0,
    currentLevel: 0,
    totalLevels: 4,
    targetLevel: "L3",
    durationHours: 25,
    xp: 350,
    imageUrl: "https://picsum.photos/seed/course-8/400/220",
    tags: ["CSS", "Architecture", "Frontend"],
  },
];

const STATS = {
  enrolled: MOCK_COURSES.length,
  completed: MOCK_COURSES.filter((c) => c.status === "completed").length,
  inProgress: MOCK_COURSES.filter((c) => c.status === "in_progress").length,
};

const ROLE_COUNTS = {
  all: MOCK_COURSES.length,
  backend: MOCK_COURSES.filter((c) => c.role === "backend").length,
  frontend: MOCK_COURSES.filter((c) => c.role === "frontend").length,
};

const ROLE_TABS = [
  { id: null as string | null, label: "All Roles" },
  { id: "backend" as const, label: "Backend Engineer" },
  { id: "frontend" as const, label: "Frontend Engineer" },
] as const;

export const CoursesPage = () => {
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredCourses = useMemo(
    () => filterCoursesByRole(MOCK_COURSES, activeRole),
    [activeRole],
  );

  const totalPages = Math.ceil(filteredCourses.length / COURSE_PAGE_SIZE);

  const safePage = getSafeCoursePage(currentPage, totalPages);

  const paginatedCourses = useMemo(
    () => paginateCourses(filteredCourses, safePage),
    [filteredCourses, safePage],
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Page Header */}
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
              count={STATS.enrolled}
              label="Enrolled"
              className="bg-brand-50 border-brand-100 text-brand-700 [&_svg]:text-brand-500"
            />
            <StatsPill
              icon={<CheckIconSmall />}
              count={STATS.completed}
              label="Completed"
              className="bg-success-50 border-success-200 text-success-700 [&_svg]:text-success-600"
            />
            <StatsPill
              icon={<ClockIconSmall />}
              count={STATS.inProgress}
              label="In Progress"
              className="bg-warning-50 border-warning-200 text-warning-700 [&_svg]:text-warning-600"
            />
          </div>
        </div>
      </header>

      {/* Role Tabs */}
      <div
        role="tablist"
        aria-label="Course roles"
        className="flex items-center gap-6 border-b border-line-default"
      >
        {ROLE_TABS.map((tab) => {
          const count =
            tab.id === null
              ? ROLE_COUNTS.all
              : tab.id === "backend"
                ? ROLE_COUNTS.backend
                : ROLE_COUNTS.frontend;
          const isActive = activeRole === tab.id;
          return (
            <button
              key={tab.label}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => {
                setActiveRole(tab.id);
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

      {/* Toolbar */}
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

      {/* Course Grid */}
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

      {/* Pagination */}
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
    className="w-5 h-5 text-purple-600"
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
