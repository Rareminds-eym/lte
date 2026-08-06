import type React from "react";
import { CourseCardGridSkeleton } from "@/entities/course";
import { Skeleton, SkeletonGroup } from "@/shared/ui";

/**
 * CoursesPage page-level loading skeleton.
 * Composes CourseCardGridSkeleton and header skeleton using generic Skeleton primitives.
 */
export const CoursesPageSkeleton: React.FC = () => {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <SkeletonGroup
        className="flex items-start justify-between gap-6"
        aria-label="Loading courses..."
      >
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0 mt-1" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Skeleton className="w-24 h-10 rounded-full" />
          <Skeleton className="w-24 h-10 rounded-full" />
          <Skeleton className="w-24 h-10 rounded-full" />
        </div>
      </SkeletonGroup>
      <div className="h-px bg-line-default w-full" />
      <CourseCardGridSkeleton />
    </div>
  );
};
