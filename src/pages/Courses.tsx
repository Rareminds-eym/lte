import { useState, useMemo } from "react";
import { CourseCard, type Course } from "@/entities/course";
import { Pagination } from "@/widgets";
import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib";

// ponytail: mock data, replace with TanStack Query + entities/course/api/ when backend exists
const PAGE_SIZE = 6;
const MOCK_COURSES: Course[] = [
  {
    id: "1",
    title: "Observability Mastery",
    description:
      "Master OpenTelemetry, metrics, logs, and distributed tracing to build production-ready observability into your systems.",
    category: "Backend Engineer",
    level: "Intermediate",
    role: "backend",
    status: "in_progress",
    progress: 35,
    currentLevel: 1,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 45,
    xp: 500,
    badge: "OBS-L2",
    imageUrl: "https://picsum.photos/seed/course-1/400/220",
    tags: ["Observability & Debugging", "Software Engineering", "Applied Skill"],
  },
  {
    id: "2",
    title: "Distributed Systems Design",
    description:
      "Learn to architect scalable and resilient distributed systems using proven patterns and modern cloud-native technologies.",
    category: "Backend Engineer",
    level: "Advanced",
    role: "backend",
    status: "in_progress",
    progress: 60,
    currentLevel: 2,
    totalLevels: 6,
    targetLevel: "L4",
    durationHours: 60,
    xp: 750,
    badge: "SYS-L3",
    imageUrl: "https://picsum.photos/seed/course-2/400/220",
    tags: ["System Design", "Architecture", "Applied Skill"],
  },
  {
    id: "3",
    title: "Advanced SQL & Databases",
    description:
      "Deep dive into query optimization, indexing strategies, and database design patterns for high-performance applications.",
    category: "Backend Engineer",
    level: "Intermediate",
    role: "backend",
    status: "completed",
    progress: 100,
    currentLevel: 5,
    totalLevels: 5,
    targetLevel: "L3",
    durationHours: 40,
    xp: 600,
    badge: "SQL-L2",
    imageUrl: "https://picsum.photos/seed/course-3/400/220",
    tags: ["Databases", "SQL", "Engineering"],
  },
  {
    id: "4",
    title: "System Design Fundamentals",
    description:
      "Build a strong foundation in system design concepts including load balancing, caching, and database partitioning.",
    category: "Backend Engineer",
    level: "Beginner",
    role: "backend",
    status: "not_started",
    progress: 0,
    currentLevel: 0,
    totalLevels: 4,
    targetLevel: "L2",
    durationHours: 30,
    xp: 400,
    imageUrl: "https://picsum.photos/seed/course-4/400/220",
    tags: ["System Design", "Fundamentals", "Applied Skill"],
  },
  {
    id: "5",
    title: "Microservices Architecture",
    description:
      "Design and implement microservices using event-driven patterns, service mesh, and container orchestration.",
    category: "Backend Engineer",
    level: "Advanced",
    role: "backend",
    status: "in_progress",
    progress: 25,
    currentLevel: 1,
    totalLevels: 6,
    targetLevel: "L4",
    durationHours: 55,
    xp: 700,
    badge: "MSA-L2",
    imageUrl: "https://picsum.photos/seed/course-5/400/220",
    tags: ["Microservices", "Architecture", "DevOps"],
  },
  {
    id: "6",
    title: "React Performance",
    description:
      "Optimize React applications with profiling, memoization, code splitting, and rendering strategy best practices.",
    category: "Frontend Engineer",
    level: "Intermediate",
    role: "frontend",
    status: "completed",
    progress: 100,
    currentLevel: 4,
    totalLevels: 4,
    targetLevel: "L3",
    durationHours: 35,
    xp: 500,
    badge: "RCT-L2",
    imageUrl: "https://picsum.photos/seed/course-6/400/220",
    tags: ["React", "Performance", "Frontend"],
  },
  {
    id: "7",
    title: "TypeScript Advanced Patterns",
    description:
      "Master advanced TypeScript features including conditional types, template literals, and mapped types for real-world codebases.",
    category: "Frontend Engineer",
    level: "Advanced",
    role: "frontend",
    status: "not_started",
    progress: 0,
    currentLevel: 0,
    totalLevels: 5,
    targetLevel: "L4",
    durationHours: 40,
    xp: 550,
    imageUrl: "https://picsum.photos/seed/course-7/400/220",
    tags: ["TypeScript", "Patterns", "Engineering"],
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

export const Courses = () => {
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredCourses = useMemo(
    () => (activeRole ? MOCK_COURSES.filter((c) => c.role === activeRole) : MOCK_COURSES),
    [activeRole],
  );

  const totalPages = Math.ceil(filteredCourses.length / PAGE_SIZE);

  const safePage = Math.min(currentPage, Math.max(1, totalPages));

  const paginatedCourses = useMemo(
    () => filteredCourses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredCourses, safePage],
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Page Header */}
      <header>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 mt-1">
              <BookIcon />
            </div>
            <div>
              <h1 className="text-[32px] font-bold text-[#111827] leading-tight">My Courses</h1>
              <p className="text-[15px] text-[#6B7280] mt-1">
                Track your enrolled courses and continue where you left off.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <StatsPill
              icon={<BookIconSmall />}
              count={STATS.enrolled}
              label="Enrolled"
              className="bg-purple-50 border-purple-200 text-purple-700 [&_svg]:text-purple-500"
            />
            <StatsPill
              icon={<CheckIconSmall />}
              count={STATS.completed}
              label="Completed"
              className="bg-emerald-50 border-emerald-200 text-emerald-700 [&_svg]:text-emerald-500"
            />
            <StatsPill
              icon={<ClockIconSmall />}
              count={STATS.inProgress}
              label="In Progress"
              className="bg-amber-50 border-amber-200 text-amber-700 [&_svg]:text-amber-500"
            />
          </div>
        </div>
      </header>

      {/* Role Tabs */}
      <div role="tablist" aria-label="Course roles" className="flex items-center gap-6">
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
                "relative pb-3 text-sm font-medium transition-colors",
                isActive ? "text-[#2563EB]" : "text-[#6B7280] hover:text-gray-700",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[11px] font-semibold rounded-full",
                  isActive ? "bg-blue-100 text-[#2563EB]" : "bg-gray-100 text-[#6B7280]",
                )}
              >
                {count}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563EB] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <hr className="border-gray-200" />

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" icon={<FilterIcon />} className="rounded-full">
          Filter
        </Button>

        <span className="text-sm text-[#6B7280] font-medium">{filteredCourses.length} courses</span>
      </div>

      {/* Course Grid */}
      {paginatedCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {paginatedCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-[#6B7280]">No courses found on this page.</div>
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

const BookIconSmall: React.FC = () => (
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
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
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
