import type React from "react";
import { useNavigate } from "react-router-dom";
import type { CurrentJourneyData, JourneyState } from "@/entities/dashboard";
import { ROUTES, routeForLevel, routeForModule } from "@/shared/config";
import { Image } from "@/shared/ui";
import {
  ArrowRightIcon,
  BrainIcon,
  ClockIcon,
  DocumentIcon,
  LightbulbIcon,
} from "@/shared/ui/icons";

export interface JourneyHeroProps {
  data: CurrentJourneyData | null;
  state: JourneyState;
}

export const JourneyHero: React.FC<JourneyHeroProps> = ({ data, state }) => {
  const navigate = useNavigate();
  const continueUrl =
    data?.levelId !== undefined && data?.moduleNo !== undefined
      ? routeForModule(data.levelId, data.moduleNo)
      : null;
  const detailsUrl =
    data?.capabilityCode && data?.levelId ? routeForLevel(data.capabilityCode, data.levelId) : null;

  if (!data) {
    return (
      <div className="relative bg-surface-hero text-content-inverse rounded-2xl p-6 lg:p-8 overflow-hidden shadow-lg flex flex-col justify-between min-h-[340px]">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[340px] h-[340px] opacity-20 pointer-events-none translate-x-0">
          <Image
            src="/assets/images/mesh_orb.png"
            alt="3D Mesh Sphere Graphic"
            priority
            className="w-full h-full object-contain"
          />
        </div>
        <div className="relative z-10 space-y-6 max-w-[640px]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-content-on-dark-muted mb-2">
              CONTINUE YOUR JOURNEY
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-content-inverse">
              {state === "completed"
                ? "Level Complete — Outstanding Work!"
                : "Your Journey Starts Here"}
            </h1>
            <p className="text-sm text-content-on-dark-muted mt-2 leading-relaxed">
              {state === "completed"
                ? "You finished every level in this track. Pick your next capability to keep the momentum going."
                : "Choose a career path and capability to unlock your first learning level."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(ROUTES.MY_COURSES)}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-content-inverse font-semibold text-sm rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              {state === "completed" ? "Choose Next Capability" : "Explore Career Paths"}
              <ArrowRightIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              clampClass: "line-clamp-2",
              icon: <BrainIcon size={14} className="text-content-on-dark-muted shrink-0 mt-1" />,
            },
            {
              label: "Output",
              value: data.output,
              clampClass: "line-clamp-2",
              icon: <DocumentIcon size={14} className="text-content-on-dark-muted shrink-0 mt-1" />,
            },
            {
              label: "Why it matters",
              value: data.whyItMatters,
              clampClass: "line-clamp-3",
              icon: (
                <LightbulbIcon size={14} className="text-content-on-dark-muted shrink-0 mt-1" />
              ),
            },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              {item.icon}
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
              <ClockIcon size={14} />
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
            <ArrowRightIcon size={16} />
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
