import type React from "react";

export const CourseSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse">
      <div className="h-full border border-gray-200 overflow-hidden rounded-2xl bg-white shadow-sm">
        {/* Image Skeleton */}
        <div className="h-40 bg-gradient-to-br from-gray-200 to-gray-300" />

        {/* Card Header Skeleton */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between mb-2">
            <div className="h-6 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-6 bg-gray-300 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-full" />
        </div>

        {/* Card Content Skeleton */}
        <div className="p-5 pt-0 space-y-4">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="flex items-center gap-4">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-10 bg-gray-200 rounded w-full" />
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
