import type React from "react";
import { StartAssessmentButton } from "@/features/start-assessment";
import { BookOpenIcon } from "@/shared/ui/icons";

export const LearningPathEmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-4 py-12 text-center w-full">
      <div className="max-w-md w-full p-8 rounded-2xl border border-line-default bg-surface-primary shadow-xs hover:shadow-md transition-shadow duration-300">
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-6">
          <BookOpenIcon size={32} className="text-brand-600 animate-pulse" />
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
