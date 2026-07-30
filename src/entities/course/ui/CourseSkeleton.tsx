import type React from "react";

export const CourseSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse">
      <div className="h-full border border-line-subtle overflow-hidden rounded-2xl bg-surface-primary shadow-sm">
        {/* Image Skeleton */}
        <div className="h-40 bg-surface-muted" />

        {/* Card Header Skeleton */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between mb-2">
            <div className="h-6 bg-surface-muted rounded w-20" />
            <div className="h-4 bg-surface-muted rounded w-16" />
          </div>
          <div className="h-6 bg-surface-muted rounded w-3/4 mb-2" />
          <div className="h-4 bg-surface-muted rounded w-full" />
        </div>

        {/* Card Content Skeleton */}
        <div className="p-5 pt-0 space-y-4">
          <div className="h-4 bg-surface-muted rounded w-full" />
          <div className="h-4 bg-surface-muted rounded w-5/6" />
          <div className="flex items-center gap-4">
            <div className="h-4 bg-surface-muted rounded w-20" />
            <div className="h-4 bg-surface-muted rounded w-16" />
          </div>
          <div className="h-10 bg-surface-muted rounded w-full" />
        </div>
      </div>
    </div>
  );
};

export const CourseGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CourseSkeleton key={i} />
      ))}
    </div>
  );
};
