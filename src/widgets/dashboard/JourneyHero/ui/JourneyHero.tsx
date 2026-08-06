import type React from "react";
import { useNavigate } from "react-router-dom";
import type { CurrentJourneyData } from "@/entities/dashboard";
import { Image } from "@/shared/ui";

export interface JourneyHeroProps {
  data: CurrentJourneyData;
}

export const JourneyHero: React.FC<JourneyHeroProps> = ({ data }) => {
  const navigate = useNavigate();
  const continueUrl =
    data.levelId !== undefined && data.moduleNo !== undefined
      ? `/my-courses/${data.levelId}/modules/${data.moduleNo}`
      : null;
  const detailsUrl = data.capabilityCode
    ? `/courses/${data.capabilityCode}/levels/${data.levelId}`
    : null;

  return (
    <div className="relative bg-surface-hero text-content-inverse rounded-2xl p-6 lg:p-8 overflow-hidden shadow-lg flex flex-col justify-between min-h-[340px]">
      {/* Background Graphic: 3D Orb Mesh using shared Image component */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[340px] h-[340px] opacity-20 pointer-events-none translate-x-0">
        <Image
          src="/assets/images/mesh_orb.png"
          alt="3D Mesh Sphere Graphic"
          loading="eager"
          priority
          className="w-full h-full object-contain"
        />
      </div>

      <div className="relative z-10 space-y-6 max-w-[640px]">
        {/* Top Header */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-content-on-dark-muted mb-2">
            CONTINUE YOUR JOURNEY
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-content-inverse">
              {data.title}
            </h1>
            <span className="px-3 py-1 text-xs font-semibold bg-surface-hero-elevated text-content-on-dark rounded-full">
              {data.moduleInfo}
            </span>
          </div>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {[
            {
              label: "Capability",
              value: data.capability,
              icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
            },
            {
              label: "Output",
              value: data.output,
              clampClass: "line-clamp-2",
              icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
            },
            {
              label: "Why it matters",
              value: data.whyItMatters,
              clampClass: "line-clamp-3",
              icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
            },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <svg
                aria-hidden="true"
                className="w-5 h-5 text-content-on-dark-muted shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <div>
                <div className="text-[10px] text-content-on-dark-muted font-medium">
                  {item.label}
                </div>
                <div
                  className={`text-sm font-semibold text-content-inverse mt-0.5 leading-snug ${item.clampClass ?? ""}`}
                >
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress Section */}
        <div className="space-y-3 pt-6">
          <div className="flex items-center justify-between text-xs font-semibold text-content-on-dark">
            <span>Journey Progress</span>
            <span className="text-base font-extrabold text-content-inverse">
              {data.progressPercentage}%
            </span>
          </div>

          <div className="w-full bg-surface-hero-elevated/50 rounded-full h-2 overflow-hidden">
            <div
              className="bg-success-500 h-full rounded-full"
              style={{ width: `${data.progressPercentage}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-content-on-dark-muted pt-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success-500 inline-block" />
                <span className="text-content-on-dark">{data.completedCount} Completed</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" />
                <span className="text-content-on-dark">{data.inProgressCount} In Progress</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-content-on-dark-subtle inline-block" />
                <span className="text-content-on-dark">{data.remainingCount} Remaining</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {data.timeRemaining && <span>{data.timeRemaining}</span>}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => continueUrl && navigate(continueUrl)}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-content-inverse font-semibold text-sm rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span>Continue Challenge</span>
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => detailsUrl && navigate(detailsUrl)}
            className="px-6 py-2.5 bg-surface-hero-button hover:bg-surface-hero-elevated text-content-on-dark font-semibold text-sm rounded-lg border border-surface-hero-elevated transition-colors cursor-pointer"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};
