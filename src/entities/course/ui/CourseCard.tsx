import type { Course } from "../model/types";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";
import type React from "react";

export interface CourseCardProps {
  course: Course;
  className?: string;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, className }) => {
  const actionLabel =
    course.status === "not_started"
      ? "Start"
      : course.status === "in_progress"
        ? "Continue"
        : "Review";

  const actionVariant: "primary" | "outline" =
    course.status === "not_started" ? "primary" : "outline";
  const actionClass =
    course.status === "completed"
      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
      : course.status === "in_progress"
        ? "border-blue-600 text-blue-600 hover:bg-blue-50"
        : "";

  return (
    <article
      className={cn(
        "bg-white rounded-[18px] shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden",
        className,
      )}
    >
      <div className="relative">
        <img
          src={course.imageUrl}
          alt={course.title}
          loading="lazy"
          className="w-full h-[220px] object-cover"
        />
        {course.badge && (
          <span className="absolute top-3 left-3 bg-black/50 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
            {course.badge}
          </span>
        )}
        {course.status === "completed" && (
          <span className="absolute top-3 right-3 bg-[#16A34A] text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
            DONE
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5 gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-[#2563EB] uppercase">
            {course.category}
          </span>
          <span className="text-[11px] font-medium text-gray-400 uppercase">{course.level}</span>
        </div>

        <h3 className="text-2xl font-bold text-[#111827] line-clamp-3 leading-snug">
          {course.title}
        </h3>

        <p className="text-[15px] text-[#6B7280] line-clamp-2 leading-relaxed">
          {course.description}
        </p>

        <div className="flex flex-wrap gap-2">
          {course.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium text-[#6B7280] bg-gray-100 px-2.5 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between text-xs text-[#6B7280]">
            <span>
              Level {course.currentLevel} of {course.totalLevels}
            </span>
            <span className="font-semibold text-gray-700">TARGET: {course.targetLevel}</span>
          </div>

          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                course.status === "completed" ? "bg-[#16A34A]" : "bg-[#2563EB]",
              )}
              style={{ width: `${course.progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-4 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1">
              <ClockIcon />
              {course.durationHours}h
            </span>
            <span className="flex items-center gap-1">
              <StarIcon />
              {course.xp} XP
            </span>
          </div>

          <Button variant={actionVariant} size="sm" className={actionClass}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </article>
  );
};

const ClockIcon: React.FC = () => (
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

const StarIcon: React.FC = () => (
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
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
