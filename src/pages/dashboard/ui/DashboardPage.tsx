import type React from "react";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { useDashboardData } from "@/entities/dashboard";
import { DashboardContent, DashboardSkeleton } from "@/widgets/dashboard";
import { LearningPathEmptyState } from "@/widgets/learning-path";

export const DashboardPage: React.FC = () => {
  const { data, isPending, isError } = useDashboardData();
  const needsAssessment = useLearningPathStore((s) => s.needsAssessment);
  const activeLearningPathLoading = useLearningPathStore((s) => s.activeLearningPathLoading);

  // Loading state: use the structured DashboardSkeleton to prevent layout shift
  if (isPending || activeLearningPathLoading) {
    return <DashboardSkeleton />;
  }

  if (needsAssessment) {
    return <LearningPathEmptyState />;
  }

  if (isError) {
    return (
      <div className="p-8 text-center bg-surface-primary rounded-2xl border border-line-default max-w-lg mx-auto my-12 shadow-sm">
        <h2 className="text-lg font-bold text-content-primary mb-2">Unable to load Dashboard</h2>
        <p className="text-xs text-content-secondary mb-4">
          There was an error loading your dashboard metrics. Please try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-brand-600 text-content-inverse font-semibold text-xs rounded-lg hover:bg-brand-700 transition-colors cursor-pointer"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return <DashboardContent data={data} />;
};
