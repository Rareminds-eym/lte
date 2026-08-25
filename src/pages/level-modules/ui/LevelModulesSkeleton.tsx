import type React from "react";
import { Skeleton, SkeletonGroup } from "@/shared/ui";

/**
 * LevelModulesSkeleton page-level loading skeleton.
 * Mirrors the structure of the LevelModulesPage (Hero, Stats, Problem Statement, and Module list).
 */
export const LevelModulesSkeleton: React.FC = () => {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Back to courses link skeleton */}
      <SkeletonGroup
        className="flex items-center gap-1.5 py-1"
        aria-label="Loading level modules..."
      >
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32 rounded" />
      </SkeletonGroup>

      {/* Hero Banner Skeleton */}
      <div className="rounded-3xl bg-surface-hero p-6 sm:p-8 md:p-10 space-y-4">
        <Skeleton className="h-6 w-20 rounded-full bg-surface-hero-button" />
        <Skeleton className="h-8 w-1/2 bg-surface-hero-button rounded" />
        <Skeleton className="h-4 w-3/4 bg-surface-hero-button rounded" />
      </div>

      {/* Stats Bar Skeleton */}
      <div className="rounded-2xl border border-line-default bg-surface-primary p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="w-full sm:w-60 space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-8 rounded" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </div>

      {/* Problem Statement Skeleton */}
      <div className="bg-white rounded-2xl border border-line-default p-6 space-y-3">
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
      </div>

      {/* Module List Header Skeleton */}
      <div className="space-y-2 pt-2">
        <Skeleton className="h-6 w-36 rounded" />
        <Skeleton className="h-4 w-60 rounded" />
      </div>

      {/* Module Rows Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-line-default bg-surface-primary p-5 flex items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-1/3 rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>
            <Skeleton className="h-10 w-24 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};
