import type React from "react";
import { Skeleton, SkeletonGroup } from "@/shared/ui";

export const CourseDetailSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface-secondary pb-16" data-testid="course-detail-skeleton">
      <SkeletonGroup aria-label="Loading course details" className="space-y-6">
        {/* Hero Banner Skeleton */}
        <div className="rounded-3xl bg-surface-hero p-6 sm:p-8 md:p-10 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-20 rounded-full bg-surface-hero-button" />
            <Skeleton className="h-6 w-28 rounded-full bg-surface-hero-button" />
          </div>
          <Skeleton className="h-4 w-48 bg-surface-hero-button rounded" />
          <Skeleton className="h-8 w-3/4 bg-surface-hero-button rounded" />
          <Skeleton className="h-4 w-full bg-surface-hero-button rounded" />
          <Skeleton className="h-4 w-5/6 bg-surface-hero-button rounded" />
        </div>

        {/* Stats Overlay Skeleton */}
        <div className="rounded-2xl border border-border-default bg-surface-primary p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
          <div className="w-full md:w-72 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>

        {/* Course Levels Skeleton */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-4 w-80 rounded" />
          </div>
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      </SkeletonGroup>
    </div>
  );
};
