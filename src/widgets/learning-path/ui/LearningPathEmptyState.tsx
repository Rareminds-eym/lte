import type React from "react";
import { StartAssessmentButton } from "@/features/start-assessment";

export const LearningPathEmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 py-12 text-center w-full">
      <div className="max-w-md w-full p-8 rounded-2xl border border-line-default bg-surface-primary shadow-xs hover:shadow-md transition-shadow duration-300">
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-brand-600 animate-pulse"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-content-primary mb-2">No learning path yet</h2>
        <p className="text-sm text-content-secondary mb-6 leading-relaxed">
          Unlock your personalized learning path by completing the SkillPassport career assessment.
        </p>
        <div className="flex justify-center">
          <StartAssessmentButton
            size="lg"
            className="px-8 cursor-pointer font-semibold shadow-xs"
          />
        </div>
      </div>
    </div>
  );
};
