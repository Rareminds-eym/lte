import type React from "react";
import { Button } from "@/shared/ui/Button";
import {
  BeakerIcon,
  BookOpenIcon,
  CertificateIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CodeBracketsIcon,
  DocumentIcon,
  GraduationCapIcon,
  LayersIcon,
  LightbulbIcon,
  LightningBoltIcon,
  LockIcon,
  SparklesIcon,
  TargetIcon,
  TrendingArrowIcon,
  TrendUpIcon,
} from "@/shared/ui/icons";

export interface StageTag {
  name: string;
  status: "completed" | "active" | "locked";
  duration?: string;
  code?: string;
}

export interface ModuleDetailBlock {
  problem?: string;
  prerequisites?: string[];
  commonConfusion?: string[];
  industryChallenge?: string;
  whatYoullLearn?: string[];
  whenToApply?: string;
}

export interface ModuleItem {
  id: string;
  moduleNumber: number;
  duration: string;
  title: string;
  description: string;
  status: "completed" | "active" | "locked";
  progressPercentage?: number;
  details?: ModuleDetailBlock;
  stages?: StageTag[];
  completedStages?: string[];
}

import { useNavigate } from "react-router-dom";
import {
  formatLteStageLabel,
  type LevelModuleSummary,
  LTE_STAGE_SEQUENCE,
  normalizeLteStageName,
} from "@/entities/course";

export interface LevelModuleListProps {
  modules?: LevelModuleSummary[];
  levelId?: string;
  moduleDurationMinutes?: number;
  onSelectModule?: (moduleNo: number) => void;
}

export const LevelModuleList: React.FC<LevelModuleListProps> = ({
  modules,
  levelId,
  moduleDurationMinutes,
  onSelectModule,
}) => {
  const navigate = useNavigate();

  const displayModules: ModuleItem[] =
    modules && modules.length > 0
      ? modules.map((m, index) => {
          // Resolve status dynamically based on progress and completeness of preceding modules
          let status: "completed" | "active" | "locked";
          const isCompleted =
            m.isCompleted || (m.progressPercentage !== undefined && m.progressPercentage >= 100);

          if (isCompleted) {
            status = "completed";
          } else if (index === 0) {
            status = "active";
          } else {
            const prevModule = modules[index - 1];
            const isPrevCompleted =
              prevModule &&
              (prevModule.isCompleted ||
                (prevModule.progressPercentage !== undefined &&
                  prevModule.progressPercentage >= 100));
            if (isPrevCompleted) {
              status = "active";
            } else {
              status = "locked";
            }
          }

          // Bind real progress percentage from database summary
          const progressPercentage = m.progressPercentage;

          // Parse JSONB fields from database
          const parseArrayField = (value: unknown): string[] | undefined => {
            if (!value) return undefined;
            try {
              if (Array.isArray(value)) {
                return value.map((v: unknown) => (typeof v === "string" ? v : String(v)));
              }
              if (typeof value === "object" && value !== null) {
                // Try to extract array from JSONB object or return undefined
                const obj = value as Record<string, unknown>;
                const items = obj["items"];
                if (items && Array.isArray(items)) {
                  return items.map((v: unknown) => (typeof v === "string" ? v : String(v)));
                }
                return undefined;
              }
              if (typeof value === "string") {
                return [value];
              }
              return undefined;
            } catch {
              return undefined;
            }
          };

          // Build details from database fields
          const details: ModuleDetailBlock = {
            problem: m.module_problem_statement || undefined,
            prerequisites: parseArrayField(m.prerequisites),
            commonConfusion: parseArrayField(m.user_confusion),
            industryChallenge: m.industry_challenge || undefined,
            whatYoullLearn: parseArrayField(m.what_youll_learn),
            whenToApply: m.when_to_apply || undefined,
          };

          const durationHrs =
            moduleDurationMinutes && moduleDurationMinutes > 0
              ? Math.ceil(moduleDurationMinutes / 60)
              : 0;

          return {
            id: m.id,
            moduleNumber: m.moduleNo,
            duration: durationHrs > 0 ? `${durationHrs} hrs` : "TBD",
            title: m.title,
            description: m.description,
            status,
            progressPercentage,
            completedStages: m.completedStages,
            details: Object.values(details).some((v) => v !== undefined) ? details : undefined,
            stages: undefined,
          };
        })
      : [];

  // Find the first active module or the first one overall
  const activeModule = displayModules.find((m) => m.status === "active");
  const isCourseCompleted =
    displayModules.length > 0 && displayModules.every((module) => module.status === "completed");
  const progressText = isCourseCompleted
    ? "Course Completed"
    : activeModule
      ? `MOD-${activeModule.moduleNumber} In Progress`
      : "No module in progress";

  const progressBadgeColor = isCourseCompleted
    ? "bg-success-50 text-success-600 border border-success-200/90"
    : activeModule
      ? "bg-warning-50 text-warning-600 border border-warning-200/90"
      : "bg-surface-muted text-content-muted border border-line-default";

  return (
    <div className="w-full mt-10 space-y-8">
      {/* Section Header Bar matching 2nd image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 px-1">
        <div className="flex items-center gap-3">
          {/* Purple Book Icon Container */}
          <div className="w-10 h-10 rounded-xl bg-purple-100/70 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <BookOpenIcon className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Course Modules</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {displayModules.length} modules · 6E Problem-Based Learning Framework
            </p>
          </div>
        </div>

        {/* Right Badges */}
        <div className="flex items-center gap-3">
          {/* Enrolled Badge */}
          <span className="px-3.5 py-1.5 bg-brand-50 text-brand-600 text-xs font-semibold rounded-full border border-brand-200/80 flex items-center gap-1.5 shadow-2xs">
            <LayersIcon className="w-3.5 h-3.5 text-brand-600" />
            <span>Enrolled</span>
          </span>

          {/* In Progress Badge - Dynamic */}
          <span
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-2xs ${progressBadgeColor}`}
          >
            {isCourseCompleted ? (
              <CheckIcon className="w-3.5 h-3.5" />
            ) : (
              <ClockIcon className="w-3.5 h-3.5" />
            )}
            <span>{progressText}</span>
          </span>
        </div>
      </div>

      {/* Modules Vertical Timeline Container */}
      <div className="relative space-y-6">
        {displayModules.map((item) => {
          const isCompleted = item.status === "completed";
          const isActive = item.status === "active";
          const isLocked = item.status === "locked";

          return (
            <div key={item.id} className="relative flex gap-4 sm:gap-6">
              {/* Left Timeline Indicator */}
              <div className="flex flex-col items-center">
                {/* Node Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs z-10 ${
                    isCompleted
                      ? "bg-brand-600 text-white ring-4 ring-brand-100"
                      : isActive
                        ? "bg-brand-500 text-white ring-4 ring-brand-200"
                        : "bg-slate-200 text-slate-500 border border-slate-300"
                  }`}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : isLocked ? (
                    <LockIcon className="w-3.5 h-3.5" />
                  ) : (
                    item.moduleNumber
                  )}
                </div>

                {/* Vertical Connector Line */}
                <div
                  className={`w-0.5 flex-1 my-1 ${isCompleted ? "bg-brand-500" : "bg-slate-200"}`}
                />
              </div>

              {/* Right Content Card */}
              <div className="flex-1">
                <div
                  className={`rounded-2xl border transition-all ${
                    isActive
                      ? "bg-white border-brand-500 shadow-md ring-1 ring-brand-500/20"
                      : isCompleted
                        ? "bg-white border-emerald-300 shadow-xs"
                        : "bg-white border-slate-200 opacity-90"
                  }`}
                >
                  {/* Card Header Bar */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
                          isActive
                            ? "bg-brand-50 text-brand-700 border border-brand-200"
                            : isCompleted
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        MODULE - {item.moduleNumber}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <title>Module Duration</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {item.duration}
                      </span>
                    </div>

                    {/* Progress Bar (If active or completed) */}
                    {item.progressPercentage !== undefined && (
                      <div className="flex items-center gap-3 w-full sm:w-48">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isCompleted ? "bg-emerald-500" : "bg-brand-600"
                            }`}
                            style={{ width: `${item.progressPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {item.progressPercentage}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Title & Description */}
                  <div className="p-5 sm:p-6 space-y-3 bg-white">
                    <h4 className="text-lg sm:text-xl font-bold text-slate-900">{item.title}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>

                    {/* Detailed 6E Learning Grid matching reference image */}
                    {item.details && (
                      <div className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 border-t border-slate-100 mt-4">
                        {/* Problem */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-5.5 h-5.5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <DocumentIcon className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span>Problem</span>
                          </h5>
                          <p className="text-xs text-slate-600 leading-relaxed font-normal pl-7.5">
                            {item.details.problem}
                          </p>
                        </div>

                        {/* Prerequisites */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-5.5 h-5.5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <GraduationCapIcon className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span>Prerequisites</span>
                          </h5>
                          <ul className="space-y-2 text-xs text-slate-600 font-normal pl-7.5">
                            {(item.details.prerequisites ?? []).map((pt: string, i: number) => (
                              <li key={i} className="leading-snug">
                                {pt}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Common Confusion */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-5.5 h-5.5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <LightbulbIcon className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span>Common Confusion</span>
                          </h5>
                          <ul className="space-y-2 text-xs text-slate-600 font-normal pl-7.5">
                            {(item.details.commonConfusion ?? []).map((pt: string, i: number) => (
                              <li key={i} className="leading-snug">
                                {pt}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Industry Challenge */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-5.5 h-5.5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <TrendingArrowIcon className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span>Industry Challenge</span>
                          </h5>
                          <p className="text-xs text-slate-600 leading-relaxed font-normal pl-7.5">
                            {item.details.industryChallenge}
                          </p>
                        </div>

                        {/* What You'll Learn */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-5.5 h-5.5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <BookOpenIcon className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span>What You'll Learn</span>
                          </h5>
                          <ul className="space-y-2 text-xs text-slate-600 font-normal pl-7.5">
                            {(item.details.whatYoullLearn ?? []).map((pt: string, i: number) => (
                              <li key={i} className="leading-snug">
                                {pt}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* When To Apply */}
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <div className="w-5.5 h-5.5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <TargetIcon className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                            <span>When To Apply</span>
                          </h5>
                          <p className="text-xs text-slate-600 leading-relaxed font-normal pl-7.5">
                            {item.details.whenToApply}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 6E Framework Stage Tags matching exact Figma design */}
                    {(() => {
                      // Use real stages from DB if available, otherwise use framework stages
                      const stages: StageTag[] =
                        item.stages && item.stages.length > 0
                          ? item.stages
                          : LTE_STAGE_SEQUENCE.map((stage) => ({
                              name: formatLteStageLabel(stage),
                              status: "locked",
                            }));
                      const completedStageSet = new Set(
                        (item.completedStages ?? []).map(normalizeLteStageName),
                      );

                      return (
                        <div className="pt-4 flex flex-wrap gap-2.5">
                          {stages.map((stage, sIdx) => {
                            const stageName = normalizeLteStageName(stage.name);
                            // Get completion status directly from database
                            const isDone = completedStageSet.has(stageName);
                            // Stage is active if has progress but not completed
                            const isActive = !isDone && (item.progressPercentage ?? 0) > 0;
                            const name = stageName;

                            let stageIcon = <LightbulbIcon className="w-3.5 h-3.5" />;
                            if (name.includes("explore")) {
                              stageIcon = <BeakerIcon className="w-3.5 h-3.5" />;
                            } else if (name.includes("explain")) {
                              stageIcon = <LayersIcon className="w-3.5 h-3.5" />;
                            } else if (name.includes("express")) {
                              stageIcon = <CodeBracketsIcon className="w-3.5 h-3.5" />;
                            } else if (name.includes("empower")) {
                              stageIcon = <LightningBoltIcon className="w-3.5 h-3.5" />;
                            } else if (name.includes("evolve")) {
                              stageIcon = <TrendUpIcon className="w-3.5 h-3.5" />;
                            }

                            return (
                              <span
                                key={sIdx}
                                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                                  isDone
                                    ? "bg-success-50 text-success-600 border border-success-200 font-medium"
                                    : isActive
                                      ? "bg-brand-50 text-brand-600 border border-brand-200 font-semibold"
                                      : "bg-surface-subtle text-content-muted border border-border-default font-normal"
                                }`}
                              >
                                {isDone ? (
                                  <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                ) : (
                                  stageIcon
                                )}
                                <span>{stage.name}</span>
                                {stage.duration && (
                                  <span
                                    className={`ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-normal ${
                                      isDone
                                        ? "bg-success-100/60 text-success-700"
                                        : isActive
                                          ? "bg-brand-100 text-brand-700"
                                          : "bg-surface-muted text-content-muted"
                                    }`}
                                  >
                                    {stage.duration}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Footer Actions using @theme tokens */}
                  {!isLocked && (
                    <div className="p-4 sm:p-5 bg-surface-secondary border-t border-line-subtle flex flex-wrap items-center gap-3 rounded-b-2xl">
                      {isActive ? (
                        <>
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => {
                              if (onSelectModule) {
                                onSelectModule(item.moduleNumber);
                              } else if (levelId) {
                                navigate(
                                  `/my-courses/${encodeURIComponent(levelId)}/modules/${item.moduleNumber}`,
                                );
                              }
                            }}
                            className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs gap-2 cursor-pointer"
                          >
                            <span>
                              {item.progressPercentage === 100
                                ? "Review Module"
                                : item.progressPercentage && item.progressPercentage > 0
                                  ? "Continue Learning"
                                  : "Start Learning"}
                            </span>
                            <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            size="md"
                            onClick={() => {
                              if (onSelectModule) {
                                onSelectModule(item.moduleNumber);
                              } else if (levelId) {
                                navigate(
                                  `/my-courses/${encodeURIComponent(levelId)}/modules/${item.moduleNumber}`,
                                );
                              }
                            }}
                            className="bg-success-600 hover:bg-success-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs gap-2 cursor-pointer"
                          >
                            <span>Review Module</span>
                            <CheckIcon className="w-4 h-4 stroke-[2.5]" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Course Completion Timeline Row using @theme tokens */}
      <div className="relative flex gap-4 sm:gap-6 items-center pt-2">
        {/* Left Timeline Indicator */}
        <div className="flex flex-col items-center shrink-0 z-10">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
              isCourseCompleted ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            {isCourseCompleted ? (
              <CertificateIcon className="w-5 h-5 text-white" />
            ) : (
              <LockIcon className="w-5 h-5 text-slate-500" />
            )}
          </div>
        </div>

        {/* Right Content Card */}
        <div
          className={`flex-1 p-5 sm:p-7 rounded-3xl border shadow-2xs flex items-center justify-between gap-4 ${
            isCourseCompleted
              ? "bg-success-50 border-success-200"
              : "bg-surface-primary border-line-default"
          }`}
        >
          <div className="min-w-0">
            <span
              className={`block font-bold text-lg sm:text-xl tracking-tight ${
                isCourseCompleted ? "text-success-600" : "text-content-primary"
              }`}
            >
              {isCourseCompleted
                ? "Congratulations! You have completed this course"
                : "Course completion locked"}
            </span>
            {!isCourseCompleted && (
              <span className="mt-1 block text-sm font-medium text-content-muted">
                Complete all modules to unlock your course completion certificate.
              </span>
            )}
          </div>

          {isCourseCompleted ? (
            <SparklesIcon className="w-6 h-6 text-success-500 shrink-0" />
          ) : (
            <div className="h-11 w-11 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <LockIcon className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
