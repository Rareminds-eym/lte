import type React from "react";
import { cn } from "@/shared/lib";
import { Button, Image } from "@/shared/ui";
import type { Course } from "../model/types";

export interface CourseCardProps {
  course: Course;
  variant?: "grid" | "list";
  className?: string;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, variant = "grid", className }) => {
  const actionLabel =
    course.status === "not_started"
      ? "Start"
      : course.status === "in_progress"
        ? "Continue"
        : "Review";

  const barColor =
    course.status === "completed" || course.qualified ? "bg-success-600" : "bg-brand-600";

  const actionButton = (
    <Button
      variant={
        course.status === "not_started"
          ? "primary"
          : course.status === "completed"
            ? "ghost"
            : "outline"
      }
      size="sm"
      className={cn(
        "rounded-full shrink-0 font-medium text-xs px-3.5 py-1.5",
        course.status === "not_started" &&
          "bg-brand-600 hover:bg-brand-700 text-white border-transparent",
        course.status === "in_progress" &&
          "border border-brand-600 text-brand-600 hover:bg-brand-50 bg-surface-primary",
        course.status === "completed" &&
          "bg-success-50 text-success-600 hover:bg-success-100 border-transparent",
      )}
    >
      {actionLabel}
      <ArrowRightIcon />
    </Button>
  );

  const badges = (
    <>
      {course.badge && (
        <span className="absolute top-3 left-3 bg-black/50 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
          {course.badge}
        </span>
      )}
      {(course.status === "completed" || course.qualified) && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-success-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
          <CheckSmall />
          DONE
        </span>
      )}
    </>
  );

  const progressSegments = (
    <div className="flex gap-1">
      {Array.from({ length: course.totalLevels }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-[6px] flex-1 rounded-full",
            i < course.currentLevel ? barColor : "bg-surface-muted",
          )}
        />
      ))}
    </div>
  );

  const metaFooter = (
    <div className="flex items-center gap-2.5 text-xs text-content-secondary">
      <span className="flex items-center gap-1">
        <ClockIcon />
        {course.durationHours} hours
      </span>
      <span className="flex items-center gap-1">
        <FireIcon />
        <span className="text-warning-600 font-bold">{course.xp} XP</span>
      </span>
      {course.qualified && (
        <span className="inline-flex items-center gap-1 bg-success-50 text-success-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-success-200/60">
          <CheckCircleIcon />
          Qualified
        </span>
      )}
    </div>
  );

  /* ── List variant ── */
  if (variant === "list") {
    return (
      <article
        data-testid="course-card"
        className={cn(
          "bg-surface-primary rounded-2xl border border-line-subtle shadow-xs hover:shadow-md transition-all duration-200 flex overflow-hidden",
          className,
        )}
      >
        <Image
          src={course.imageUrl}
          alt={course.title}
          aspectRatio="240/200"
          wrapperClassName="w-[240px] shrink-0"
        >
          {badges}
        </Image>

        <div className="flex flex-col flex-1 p-5 gap-2 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold tracking-wide text-brand-600 uppercase">
                {course.category}
              </span>
              <span className="text-[11px] font-medium text-content-muted uppercase">
                {course.level}
              </span>
            </div>
            {actionButton}
          </div>

          <h3 className="text-[15px] font-bold text-content-primary line-clamp-1 leading-snug">
            {course.title}
          </h3>

          <p className="text-[13px] text-content-secondary line-clamp-1 leading-relaxed">
            {course.description}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {course.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium text-content-secondary bg-surface-muted px-2 py-0.5 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-6 mt-auto pt-2 border-t border-border-subtle">
            <div className="flex items-center gap-4 text-xs text-content-secondary shrink-0">
              <span className="inline-flex items-center gap-1 font-bold text-content-primary">
                Level {course.currentLevel} of {course.totalLevels}
                <InfoIcon />
              </span>
              <span className="font-semibold text-content-primary">
                TARGET: {course.targetLevel}
              </span>
            </div>
            <div className="w-32 shrink-0">{progressSegments}</div>
            {metaFooter}
          </div>
        </div>
      </article>
    );
  }

  /* ── Grid variant (default) ── */
  return (
    <article
      data-testid="course-card"
      className={cn(
        "bg-surface-primary rounded-2xl border border-line-subtle shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden",
        className,
      )}
    >
      <Image src={course.imageUrl} alt={course.title} aspectRatio="400/200">
        {badges}
      </Image>

      <div className="flex flex-col flex-1 p-5 gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-brand-600 uppercase">
            {course.category}
          </span>
          <span className="text-[11px] font-medium text-content-muted uppercase">
            {course.level}
          </span>
        </div>

        <h3 className="text-[15px] font-bold text-content-primary line-clamp-2 leading-snug">
          {course.title}
        </h3>

        <p className="text-[13px] text-content-secondary line-clamp-2 leading-relaxed">
          {course.description}
        </p>

        <div className="flex flex-wrap gap-1.5">
          {course.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium text-content-secondary bg-surface-muted px-2 py-0.5 rounded-md"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs text-content-secondary">
            <span className="inline-flex items-center gap-1 font-bold text-content-primary">
              Level {course.currentLevel} of {course.totalLevels}
              <InfoIcon />
            </span>
            <span className="font-semibold text-content-primary">TARGET: {course.targetLevel}</span>
          </div>
          {progressSegments}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          {metaFooter}
          {actionButton}
        </div>
      </div>
    </article>
  );
};

/* ── Inline icons (no deps) ── */

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

const FireIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-3.5 h-3.5 text-warning-500"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 23c-3.6 0-7-2.4-7-7 0-3.1 2.1-5.7 3.4-7.2.4-.5 1.2-.3 1.3.3.2 1.2.6 2.2 1.3 2.9.1-.9.5-2.1 1.2-3.4C13.6 5.7 14 3.5 13.6 1.6c-.1-.5.4-.9.8-.6C17.2 3 20 6.5 20 10.5c0 2.3-.8 4.5-2.2 6.1-.3.4-.6.7-.9 1C15.5 19 14 20 12 20c-1.4 0-2.5-.5-3.3-1.3-.3-.3-.1-.8.3-.9.8-.2 1.5-.6 2-1.3.4-.5.6-1.1.6-1.8 0-.3.3-.5.6-.4.8.3 1.5.9 2 1.8.6 1.1.8 2.1.8 3.1V20c1.2-.5 2.3-1.5 2.9-2.7.8-1.5 1.1-3.2 1.1-4.8 0-2.8-1.5-5.3-3.3-7-.1 1.9-.8 3.9-2.1 5.7-.7 1-1.4 1.7-2.1 2.2-.2.2-.5 0-.5-.3 0-1.1-.2-2-.7-2.8-.5-.9-1.3-1.6-2.2-2.3C7.5 9.7 7 11.5 7 13.5 7 17.1 9 20 12 20v3z" />
  </svg>
);

const ArrowRightIcon: React.FC = () => (
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
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const InfoIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-3.5 h-3.5 text-content-muted"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const CheckSmall: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-3 h-3"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CheckCircleIcon: React.FC = () => (
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
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
