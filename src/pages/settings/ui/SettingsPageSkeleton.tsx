import type React from "react";
import { Skeleton, SkeletonGroup } from "@/shared/ui";

/**
 * SettingsPage page-level loading skeleton.
 * Provides a precise visual layout transition mirroring the main settings form sections.
 */
export const SettingsPageSkeleton: React.FC = () => {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Page Header Skeleton */}
      <header>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-lg shrink-0 mt-1" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32 rounded" />
              <Skeleton className="h-4 w-64 rounded" />
            </div>
          </div>
        </div>
      </header>

      <div className="h-px bg-line-default w-full" />

      {/* Tabs Skeleton */}
      <SkeletonGroup
        className="flex gap-2 border-b border-line-default pb-px overflow-x-auto scrollbar-none"
        aria-label="Loading settings..."
      >
        <Skeleton className="h-9 w-24 rounded-t-lg" />
        <Skeleton className="h-9 w-40 rounded-t-lg" />
        <Skeleton className="h-9 w-28 rounded-t-lg" />
      </SkeletonGroup>

      {/* Section 1: Profile Card Skeleton */}
      <div className="bg-white rounded-2xl border border-line-default p-6 md:p-8 space-y-8">
        <SkeletonGroup className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
        </SkeletonGroup>

        {/* Avatar + Info Banner Skeleton */}
        <div className="bg-surface-secondary rounded-xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <div className="space-y-2 flex-1 w-full">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-4 w-48 rounded" />
          </div>
          <Skeleton className="h-8 w-32 rounded-full shrink-0" />
        </div>

        {/* Form Inputs Grid Skeleton */}
        <SkeletonGroup className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </SkeletonGroup>

        {/* Info Badges / Pills Skeleton */}
        <SkeletonGroup className="flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </SkeletonGroup>

        <div className="flex justify-end pt-4 border-t border-line-default">
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
};
