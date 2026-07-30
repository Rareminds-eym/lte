import type React from "react";
import { Skeleton, SkeletonGroup } from "@/shared/ui";

/**
 * Single course card skeleton — mirrors the visual structure of CourseCard
 * (thumbnail, badge, title, description, meta row, CTA button).
 *
 * Ownership: entities/course — it is a structural placeholder for a CourseCard.
 */
export const CourseCardSkeleton: React.FC = () => (
  <SkeletonGroup className="h-full border border-gray-200 overflow-hidden rounded-2xl bg-white shadow-sm">
    {/* Thumbnail */}
    <Skeleton className="h-40 w-full rounded-none" aria-label="Course thumbnail" />

    {/* Card header */}
    <div className="p-5 pb-3">
      <div className="flex items-start justify-between mb-2">
        <Skeleton className="h-6 w-20" aria-label="Course category" />
        <Skeleton className="h-4 w-16" aria-label="Course level" />
      </div>
      <Skeleton className="h-6 w-3/4 mb-2" aria-label="Course title" />
      <Skeleton className="h-4 w-full" aria-label="Course description" />
    </div>

    {/* Card content */}
    <div className="p-5 pt-0 space-y-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-20" aria-label="Course duration" />
        <Skeleton className="h-4 w-16" aria-label="Course XP" />
      </div>
      {/* CTA button */}
      <Skeleton className="h-10 w-full rounded-lg" aria-label="Course action" />
    </div>
  </SkeletonGroup>
);

/**
 * Responsive grid of CourseCardSkeletons.
 * Mirrors the grid layout from CoursesPage.
 */
export const CourseCardGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      // key is safe here: static list that never reorders
      <CourseCardSkeleton key={i} />
    ))}
  </div>
);
