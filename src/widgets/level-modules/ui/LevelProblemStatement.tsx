import type React from "react";

export interface LevelProblemStatementProps {
  label?: string;
  title: string;
  description: string;
  completedModules?: number;
  totalModules?: number;
}

export const LevelProblemStatement: React.FC<LevelProblemStatementProps> = ({
  label = "COURSE PROBLEM STATEMENT",
  title = "Guided Requisition Intake and Readiness Check",
  description = "A business unit manager has raised a request to hire 3 Sales Executives for the South Zone because the team missed its last two monthly revenue targets by 18% and 22%. You receive a hiring request email, an old job description, a headcount tracker, a budget approval screenshot, and a vacancy tracker showing 1 approved replacement role and 2 unapproved expansion roles. The request is incomplete because the manager has not clarified territory allocation, salary range, reporting manager, replacement versus new-role justification, and whether the budget covers all 3 positions. You must decide whether the requisition is ready for HR processing, partially ready with missing information, or blocked until role, budget, and approval gaps are clarified.",
  completedModules = 1,
  totalModules = 7,
}) => {
  return (
    <div className="relative w-full bg-surface-dark-card border border-brand-500/20 rounded-2xl p-5 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 justify-between shadow-xl overflow-hidden">
      {/* Radial Brand Glow Sheen matching Figma specs */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.18)_0%,rgba(37,99,235,0)_60%)]" />

      <div className="relative z-10 flex-1 flex flex-col items-start justify-center">
        {/* Label Pill */}
        <div className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold tracking-widest bg-brand-500/20 text-brand-200 uppercase border border-brand-500/30">
          {label}
        </div>

        {/* Title */}
        <h2 className="text-lg sm:text-2xl font-bold text-white mt-3 leading-snug tracking-tight">
          {title}
        </h2>

        {/* Description */}
        <p className="text-slate-300 text-xs sm:text-base mt-3 leading-relaxed font-normal w-full">
          {description}
        </p>
      </div>

      {/* Progress Box */}
      <div className="relative z-10 shrink-0 flex items-center justify-center md:justify-end self-center md:self-center">
        <div className="bg-brand-900/40 backdrop-blur-md rounded-2xl px-6 py-5 sm:px-7 sm:py-6 flex flex-col items-center justify-center border border-brand-500/25 shadow-md min-w-[100px] sm:min-w-[110px]">
          <span className="text-2xl sm:text-3xl font-bold text-white leading-none">
            {completedModules ?? 0}
          </span>
          <div className="w-7 sm:w-8 h-[2px] bg-brand-500/40 my-2.5 sm:my-3 rounded-full" />
          <span className="text-2xl sm:text-3xl font-bold text-white leading-none">
            {totalModules}
          </span>
          <span className="text-xs text-brand-200/80 mt-2.5 font-medium tracking-wide">
            {completedModules === 0 ? "Not started" : "Submitted"}
          </span>
        </div>
      </div>
    </div>
  );
};
