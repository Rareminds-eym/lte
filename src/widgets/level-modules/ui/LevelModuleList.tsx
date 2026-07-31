import type React from "react";
import { Button } from "@/shared/ui/Button";
import {
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
  problem: string;
  prerequisites: string | string[];
  commonConfusion: string | string[];
  industryChallenge: string;
  whatYoullLearn: string | string[];
  whenToApply: string;
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
}

const mockModules: ModuleItem[] = [
  {
    id: "mod-0",
    moduleNumber: 0,
    duration: "2.5 hrs",
    title: "System Failure Investigation",
    description: "Learn how to investigate and debug system failures in production environments.",
    status: "active",
    progressPercentage: 0,
    stages: [
      { name: "Engage", status: "active" },
      { name: "Explore", status: "locked" },
      { name: "Explain", status: "locked" },
      { name: "Express", status: "locked" },
      { name: "Empower", status: "locked" },
      { name: "Evolve", status: "locked" },
    ],
    details: {
      problem:
        "At 3:30 PM, a tired guest is waiting near the front desk while the queue grows. The learner sees a reservation for Rohan Mehta, an early-arrival note, payment/readiness uncertainty, and a room that is not yet fully inspection-cleared. Before touching any check-in or access step, the learner must identify the course mission, L1 role boundary, tools, risks, and one open validation question.",
      prerequisites: [
        "Basic awareness of hotel or reception operations",
        "Ability to read simple records and status notes",
        "No prior operational experience required",
      ],
      commonConfusion: [
        "May treat guest urgency as permission to proceed",
        "May assume a clean room is access-ready",
        "May accept a payment claim as proof",
        "May confuse helpful service with approval authority",
        "May not know which evidence must be checked first",
      ],
      industryChallenge:
        "Front-office teams must protect guest trust and service flow while coordinating reservation, identity, payment, room status, duty, and handoff evidence across different owners without allowing premature access.",
      whatYoullLearn: [
        "Why arrival-readiness evidence matters",
        "How to identify the main evidence types",
        "How L1 authority differs from supervisor approval",
        "How to recognize risk before action",
        "How to write one open validation question",
      ],
      whenToApply:
        "Use before entering an arrival room or taking any check-in, room-access, or key issuance step.",
    },
  },
  {
    id: "mod-1",
    moduleNumber: 1,
    duration: "2.5 hrs",
    title: "Case Intake & Role Boundary",
    description:
      "Learner opens the arrival case, separates facts from assumptions, identifies missing/conflicting records, and protects L1 authority while preparing intake.",
    status: "active",
    progressPercentage: 0,
    stages: [
      { name: "Engage", status: "active", duration: "1h 0m" },
      { name: "Explore", status: "locked", duration: "45m" },
      { name: "Explain", status: "locked", duration: "20m" },
      { name: "Express", status: "locked" },
      { name: "Empower", status: "locked" },
      { name: "Evolve", status: "locked" },
    ],
    details: {
      problem:
        "The learner receives the first case file. Reservation card shows guest name Rohan Mehta, ETA 09:00, folio status: early-arrival requested. Folio note: payment info pending. Room Status card: Room 412 clean - not inspected. Learner must separate facts, assumptions, missing information, and role boundary.",
      prerequisites: [
        "Completed Module 0 Course Readiness",
        "Given understands the L1 allowed and prohibited actions",
        "Can identify reservation, ID, PMS/payment, room-status, and handoff evidence",
      ],
      commonConfusion: [
        "May record the guest date as a confirmed fact",
        "May ignore the ID-name variation",
        "May skip checking PMS folio",
        "May assume room status is ready",
        "May mix assumptions with evidence",
        "May promise access while collecting information",
      ],
      industryChallenge:
        "Front-office staff must create a reliable case record from fragmented guest statements and system evidence so that the next turnover can act without repeating work or inheriting hidden assumptions.",
      whatYoullLearn: [
        "How to separate facts, claims, assumptions, and missing information",
        "How to capture supervision-justified evidence",
        "How to record PMS-folio and room-status logs",
        "How to ask safe clarification questions",
        "When supervisor approval is required",
      ],
      whenToApply:
        "Use during the first structured intake of a guest or visitor arrival case, especially when the person is waiting and the available records do not fully agree.",
    },
  },
  {
    id: "mod-2",
    moduleNumber: 2,
    duration: "2.5 hrs",
    title: "Evidence / Requirement Validation",
    description:
      "Learner validates whether reservation, identity, room status, and payment/readiness evidence is complete, matching, missing, blocked, or requires supervisor review.",
    status: "locked",
  },
  {
    id: "mod-3",
    moduleNumber: 3,
    duration: "2.5 hrs",
    title: "Guided Work Action or Handoff",
    description:
      "Learner turns validated evidence into an arrival-safe recommendation or handoff without approving check-in or keyholding access.",
    status: "locked",
  },
  {
    id: "mod-4",
    moduleNumber: 4,
    duration: "2.5 hrs",
    title: "Exceptions, Blockers, Risks & Escalations",
    description:
      "Learner identifies exceptions, blockers, dependency risks, wrong-owner risks, and pressure traps, then escalates with evidence and safe next steps.",
    status: "locked",
  },
  {
    id: "mod-5",
    moduleNumber: 5,
    duration: "2.5 hrs",
    title: "Quality, Communication & Closure",
    description:
      "Learner checks whether L1 work is clean, complete, safe, and ready for review/closure while distinguishing completed work from unresolved risks.",
    status: "locked",
  },
  {
    id: "mod-6",
    moduleNumber: 6,
    duration: "2.5 hrs",
    title: "Portfolio, Transfer & Final Validation",
    description:
      "Learner assembles evidence chain, defends decisions, applies work style to a new visitor readiness case, and proves guided L1 capability.",
    status: "locked",
  },
];

import { useNavigate } from "react-router-dom";
import type { LevelModuleSummary } from "@/entities/course";

export interface LevelModuleListProps {
  modules?: LevelModuleSummary[];
  levelId?: string;
  onSelectModule?: (moduleNo: number) => void;
}

export const LevelModuleList: React.FC<LevelModuleListProps> = ({ modules, levelId, onSelectModule }) => {
  const navigate = useNavigate();

  const displayModules: ModuleItem[] =
    modules && modules.length > 0
      ? modules.map((m, index) => {
          const defaultMock = mockModules.find((mock) => mock.moduleNumber === m.moduleNo) ?? mockModules[index % mockModules.length];

            // Status: module 0 (or published) is active, all subsequent unpublished modules are locked
            let status: "completed" | "active" | "locked";
            if (index === 0) {
              status = "active";
            } else if (m.isPublished) {
              status = "active";
            } else {
              status = "locked";
            }

            // Progress only for active modules (no completion without user progress)
            const progressPercentage = m.isPublished ? 0 : undefined;

            return {
              id: m.id,
              moduleNumber: m.moduleNo,
              duration: defaultMock?.duration ?? "2.5 hrs",
              title: m.title,
              description: m.description,
              status,
              progressPercentage,
              details: defaultMock?.details ?? mockModules[0]?.details,
              stages: defaultMock?.stages,
            };
          })
      : mockModules;

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
              6 modules · 6E Problem-Based Learning Framework
            </p>
          </div>
        </div>

        {/* Right Badges */}
        <div className="flex items-center gap-3">
          {/* Enrolled Badge */}
          <span className="px-3.5 py-1.5 bg-brand-50 text-brand-600 text-xs font-semibold rounded-full border border-brand-200/80 flex items-center gap-1.5 shadow-2xs">
            <LayersIcon className="w-3.5 h-3.5 text-brand-600" />
            <span>1.6k Enrolled</span>
          </span>

          {/* In Progress Badge */}
          <span className="px-3.5 py-1.5 bg-warning-50 text-warning-600 text-xs font-semibold rounded-full border border-warning-200/90 flex items-center gap-1.5 shadow-2xs">
            <ClockIcon className="w-3.5 h-3.5 text-warning-600" />
            <span>MOD-1 In Progress</span>
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
                  className={`w-0.5 flex-1 my-1 ${
                    isCompleted ? "bg-brand-500" : "bg-slate-200"
                  }`}
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
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <h4 className="text-lg sm:text-xl font-bold text-slate-900">
                      {item.title}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {item.description}
                    </p>

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
                            {(Array.isArray(item.details.prerequisites)
                              ? item.details.prerequisites
                              : item.details.prerequisites.split(/(?<=\.)\s+/).filter(Boolean)
                            ).map((pt, i) => (
                              <li key={i} className="leading-snug">{pt}</li>
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
                            {(Array.isArray(item.details.commonConfusion)
                              ? item.details.commonConfusion
                              : item.details.commonConfusion.split(/(?<=\.)\s+/).filter(Boolean)
                            ).map((pt, i) => (
                              <li key={i} className="leading-snug">{pt}</li>
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
                            {(Array.isArray(item.details.whatYoullLearn)
                              ? item.details.whatYoullLearn
                              : item.details.whatYoullLearn.split(/(?<=\.)\s+/).filter(Boolean)
                            ).map((pt, i) => (
                              <li key={i} className="leading-snug">{pt}</li>
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
                      const defaultStages: StageTag[] = [
                        { name: "Engage", status: item.status === "completed" ? "completed" : item.status === "active" ? "active" : "locked", duration: "1h 0m" },
                        { name: "Explore", status: item.status === "completed" ? "completed" : "locked", duration: "45m" },
                        { name: "Explain", status: item.status === "completed" ? "completed" : "locked", duration: "20m" },
                        { name: "Express", status: item.status === "completed" ? "completed" : "locked" },
                        { name: "Empower", status: item.status === "completed" ? "completed" : "locked" },
                        { name: "Evolve", status: item.status === "completed" ? "completed" : "locked" },
                      ];
                      const rawStages = item.stages && item.stages.length > 0 ? item.stages : defaultStages;
                      const stages = item.status === "locked"
                        ? rawStages.map((s) => ({ ...s, status: "locked" as const }))
                        : rawStages;

                      return (
                        <div className="pt-4 flex flex-wrap gap-2.5">
                          {stages.map((stage, sIdx) => {
                            const isDone = stage.status === "completed";
                            const isActive = stage.status === "active";
                            const name = stage.name.toLowerCase();

                            let stageIcon = <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />;
                            if (name.includes("explain")) {
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
                                {isDone ? <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" /> : stageIcon}
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
                                navigate(`/courses/${encodeURIComponent(levelId)}/modules/${item.moduleNumber}`);
                              }
                            }}
                            className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs gap-2 cursor-pointer"
                          >
                            <span>Start Learning</span>
                            <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                          </Button>
                          <Button
                            variant="primary"
                            size="md"
                            className="!bg-success-600 hover:!bg-success-700 !text-white font-bold px-5 py-2.5 rounded-xl shadow-xs gap-2"
                          >
                            <span>Submit Artifact</span>
                            <svg className="w-4 h-4 text-white rotate-[30deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            size="md"
                            className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs gap-2"
                          >
                            <span>Completed</span>
                            <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                          </Button>
                          <Button
                            variant="primary"
                            size="md"
                            className="!bg-success-600 hover:!bg-success-700 !text-white font-bold px-5 py-2.5 rounded-xl shadow-xs gap-2"
                          >
                            <span>Submitted</span>
                            <svg className="w-4 h-4 text-white rotate-[30deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
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
        {/* Left Timeline Indicator with Blue Certificate Icon */}
        <div className="flex flex-col items-center shrink-0 z-10">
          <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-md">
            <CertificateIcon className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Right Content Card */}
        <div className="flex-1 p-6 sm:p-7 rounded-3xl bg-surface-primary border border-line-default shadow-2xs flex items-center justify-between gap-4">
          <span className="text-success-300 font-bold text-lg sm:text-xl tracking-tight">
            Congratulations! You have completed this course
          </span>

          {/* Sparkles Icon from shared/ui/icons */}
          <SparklesIcon className="w-6 h-6 text-success-300 shrink-0" />
        </div>
      </div>
    </div>
  );
};
