import type React from "react";
import type { CareerTargetData } from "@/entities/dashboard";
import {
  ArrowRightIcon,
  BadgeMedalIcon,
  SlidersIcon,
  StreakFlameIcon,
  TargetArrowIcon,
  XpStatIcon,
} from "@/shared/ui/icons";

export interface CareerTargetBannerProps {
  data: CareerTargetData;
}

export const CareerTargetBanner: React.FC<CareerTargetBannerProps> = ({ data }) => {
  return (
    <div className="bg-surface-primary rounded-2xl border border-line-default p-6 sm:px-8 sm:py-6 shadow-xs">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-3">
          <div className="space-y-0.5">
            <div className="text-[12px] font-medium text-content-secondary flex items-center gap-1.5">
              <TargetArrowIcon size={16} className="text-content-primary" />
              <span>Career Target</span>
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-content-primary tracking-tight">
                {data.title}
              </h2>
              <button
                type="button"
                aria-label="Filter target roles"
                className="text-content-secondary hover:text-content-body transition-colors cursor-pointer p-0.5"
              >
                <SlidersIcon size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg aria-hidden="true" className="w-16 h-16" viewBox="0 0 36 36">
                <defs>
                  <linearGradient id="readinessRingGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" className="[stop-color:var(--color-brand-500)]" />
                    <stop offset="100%" className="[stop-color:var(--color-accent-cyan)]" />
                  </linearGradient>
                </defs>
                <path
                  stroke="url(#readinessRingGradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="16 9"
                  strokeDashoffset="8"
                  pathLength={100}
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-base font-extrabold text-content-primary">
                {data.readinessPercentage}%
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-content-secondary font-medium">Role Readiness</div>
              <div className="flex items-center gap-1.5 text-xs text-content-body">
                <span className="w-2 h-2 rounded-full bg-success-500 inline-block" />
                <span className="font-normal">{data.strengthsCount} Strengths</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-content-body">
                <span className="w-2 h-2 rounded-full bg-accent-orange-500 inline-block" />
                <span className="font-normal">{data.capabilityGapsCount} Capability Gaps</span>
              </div>
              <a
                href="#readiness-report"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors pt-0.5"
              >
                View Readiness Report <ArrowRightIcon size={12} />
              </a>
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-px h-16 bg-line-default self-center mx-2" />

        <div className="flex flex-col justify-center space-y-2.5">
          {[
            { label: "Domain", value: data.domain },
            { label: "Industry", value: data.industry },
            { label: "Level", value: data.level },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-6">
              <span className="text-xs text-content-secondary font-semibold w-16 shrink-0">
                {item.label}
              </span>
              <span className="px-4 py-1.5 bg-surface-secondary text-content-primary text-xs font-extrabold rounded-xl shadow-2xs">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div className="hidden lg:block w-px h-16 bg-line-default self-center mx-2" />

        <div className="flex items-center justify-around sm:justify-end gap-8 sm:gap-10">
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 rounded-full bg-accent-lime-100/70 border border-accent-lime-200/80 flex items-center justify-center shrink-0 mb-1.5 shadow-2xs">
              <XpStatIcon size={28} />
            </div>
            <div className="text-[11px] font-medium text-content-secondary">XP</div>
            <div className="text-xl font-black text-content-primary leading-tight my-0.5">
              {data.xp.toLocaleString()}
            </div>
            <div className="text-[11px] font-bold text-success-600">
              +{data.xpThisWeek.toLocaleString()} this week
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 rounded-full bg-accent-orange-100/70 border border-accent-orange-200/80 flex items-center justify-center shrink-0 mb-1.5 shadow-2xs">
              <StreakFlameIcon size={28} />
            </div>
            <div className="text-[11px] font-medium text-content-secondary">Streak</div>
            <div className="text-xl font-black text-content-primary leading-tight my-0.5">
              {data.streakDays} Days
            </div>
            <div className="text-[11px] font-normal text-content-muted">Keep it up!</div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 rounded-full bg-accent-purple-100/70 border border-accent-purple-200/80 flex items-center justify-center shrink-0 mb-1.5 shadow-2xs">
              <BadgeMedalIcon size={28} />
            </div>
            <div className="text-[11px] font-medium text-content-secondary">Badges</div>
            <div className="text-xl font-black text-content-primary leading-tight my-0.5">
              {data.badgesCount}
            </div>
            <a href="#badges" className="text-[11px] font-semibold text-brand-600 hover:underline">
              View all
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
