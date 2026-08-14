import type React from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/lib";
import { Button, Image, SegmentedProgressBar } from "@/shared/ui";
import {
  ArrowRightIcon,
  CheckIcon,
  DurationIcon,
  EnergyBoltIcon,
  InfoCircleIcon,
} from "@/shared/ui/icons";
import type { Course } from "../model/types";

export interface CourseCardProps {
  course: Course;
  variant?: "grid" | "list";
  className?: string;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, variant = "grid", className }) => {
  const navigate = useNavigate();
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
      onClick={() => navigate(`/my-courses/${encodeURIComponent(course.slug)}`)}
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
      <ArrowRightIcon size={14} />
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
          <CheckIcon size={12} />
          DONE
        </span>
      )}
    </>
  );

  const progressSegments = (
    <SegmentedProgressBar
      currentLevel={course.currentLevel}
      totalLevels={course.totalLevels}
      barColor={barColor}
      emptyColor="bg-surface-muted"
      heightClassName="h-[6px]"
    />
  );

  const metaFooter = (
    <div className="flex items-center gap-3.5 text-xs">
      <span className="flex items-center gap-1.5 font-medium text-content-secondary">
        <DurationIcon size={20} className="text-brand-600 shrink-0" />
        <span>{course.durationHours} hours</span>
      </span>
      <span className="flex items-center gap-1.5 font-bold text-warning-600">
        <EnergyBoltIcon size={18} className="shrink-0" />
        <span>{course.xp} XP</span>
      </span>
      {course.qualified && (
        <span className="inline-flex items-center gap-1 bg-success-50 text-success-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-success-200/60">
          <CheckIcon size={12} />
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
          "group rounded-2xl border border-line-default bg-surface-primary p-4 shadow-xs transition-all duration-200 hover:border-brand-300 hover:shadow-md flex flex-col md:flex-row gap-5",
          className,
        )}
      >
        <div className="relative w-full md:w-56 h-36 md:h-auto shrink-0 rounded-xl overflow-hidden bg-surface-muted">
          <Image
            src={course.imageUrl}
            alt={course.title}
            wrapperClassName="w-full h-full"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          >
            {badges}
          </Image>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-brand-600 tracking-wider uppercase">
                {course.roleName || course.capabilityCode}
              </span>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-content-muted">
                {course.targetLevel}
              </span>
            </div>
            <div className="self-start sm:self-auto">{actionButton}</div>
          </div>

          <h3 className="text-base font-bold text-content-primary line-clamp-1 group-hover:text-brand-600 transition-colors">
            {course.title}
          </h3>

          <p className="text-xs text-content-secondary line-clamp-2 mt-1 mb-3">
            {course.description}
          </p>

          {course.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {course.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-surface-muted text-content-secondary text-[11px] font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-auto pt-3 border-t border-border-subtle">
            <div className="flex flex-wrap items-center gap-4 text-xs text-content-secondary">
              <span className="inline-flex items-center gap-1 font-bold text-content-primary">
                Level {course.currentLevel} of {course.totalLevels}
                <InfoCircleIcon size={14} className="text-content-muted" />
              </span>
              <span className="font-semibold text-content-primary bg-surface-muted px-2 py-0.5 rounded text-[11px]">
                TARGET: {course.targetLevel}
              </span>
              <div className="w-24 sm:w-28 shrink-0">{progressSegments}</div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              {metaFooter}
            </div>
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
            {course.roleName || course.category}
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
              <span className="cursor-help inline-flex items-center">
                <InfoCircleIcon size={14} className="text-content-muted" />
              </span>
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
