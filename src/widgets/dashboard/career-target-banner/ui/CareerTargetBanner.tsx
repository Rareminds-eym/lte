import type React from "react";
import { useId } from "react";
import type { CareerTargetData } from "@/entities/dashboard";
import { DASHBOARD_CARD_HEIGHTS, UI_TEXT } from "@/shared/config";
import { toPercentage } from "@/shared/lib";
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
  const gradientId = useId();
  return (
    <section
      aria-label={UI_TEXT.careerTarget}
      className={`bg-surface-primary rounded-2xl border border-line-default p-6 sm:px-8 sm:py-6 shadow-xs overflow-hidden flex flex-col ${DASHBOARD_CARD_HEIGHTS.careerTarget}`}
    >
      <header className="mb-3 shrink-0 space-y-0.5">
        <div className="text-[12px] font-medium text-content-secondary flex items-center gap-1.5">
          <TargetArrowIcon size={16} className="text-content-primary" />
          <span>{UI_TEXT.careerTarget}</span>
        </div>
        <div className="flex items-center gap-2">
          <h2
            title={data.title}
            className="line-clamp-2 text-xl sm:text-2xl font-extrabold text-content-primary tracking-tight break-words min-w-0"
          >
            {data.title}
          </h2>
          <a
            href="#career-paths"
            aria-label={UI_TEXT.filterTargetRoles}
            title={UI_TEXT.chooseYourCareerTrack}
            className="text-content-secondary hover:text-content-body transition-colors cursor-pointer p-0.5 shrink-0"
          >
            <SlidersIcon size={16} />
          </a>
        </div>
      </header>
      <section
        aria-label={UI_TEXT.cardContent(UI_TEXT.careerTarget)}
        /* biome-ignore lint/a11y/noNoninteractiveTabindex: Labelled scroll regions need keyboard focus for overflow content. */
        tabIndex={0}
        className="min-h-0 flex-auto overflow-x-hidden overflow-y-auto"
      >
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6">
          <div className="flex flex-col gap-3 min-w-0 xl:flex-1">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <meter
                  aria-label={UI_TEXT.roleReadiness}
                  min={0}
                  max={100}
                  value={toPercentage(data.readinessPercentage)}
                  className="sr-only"
                />
                <svg aria-hidden="true" className="w-16 h-16" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" className="[stop-color:var(--color-brand-500)]" />
                      <stop offset="100%" className="[stop-color:var(--color-accent-cyan)]" />
                    </linearGradient>
                  </defs>
                  <path
                    stroke={`url(#${gradientId})`}
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
                  {toPercentage(data.readinessPercentage)}%
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-content-secondary font-medium">
                  {UI_TEXT.roleReadinessHeading}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-content-body">
                  <span className="w-2 h-2 rounded-full bg-success-500 inline-block" />
                  <span className="font-normal">
                    {data.strengthsCount} {UI_TEXT.strengths}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-content-body">
                  <span className="w-2 h-2 rounded-full bg-accent-orange-500 inline-block" />
                  <span className="font-normal">
                    {data.capabilityGapsCount} {UI_TEXT.capabilityGaps}
                  </span>
                </div>
                <a
                  href="#capability-gap-map"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors pt-0.5"
                >
                  {UI_TEXT.viewReadinessReport}
                  <ArrowRightIcon size={12} />
                </a>
              </div>
            </div>
          </div>

          <div className="hidden xl:block w-px h-16 bg-line-default self-center mx-2 shrink-0" />

          <div className="flex flex-col justify-center space-y-2.5 min-w-0 xl:flex-1">
            {[
              { label: UI_TEXT.domain, value: data.domain },
              { label: UI_TEXT.industry, value: data.industry },
              { label: UI_TEXT.level, value: data.level },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-6">
                <span className="text-xs text-content-secondary font-semibold w-16 shrink-0">
                  {item.label}
                </span>
                <span className="px-4 py-1.5 bg-surface-secondary text-content-primary text-xs font-extrabold rounded-xl shadow-2xs min-w-0 break-words">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div className="hidden xl:block w-px h-16 bg-line-default self-center mx-2 shrink-0" />

          <div className="flex flex-wrap items-center justify-around sm:justify-end gap-6 sm:gap-10 shrink-0">
            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-full bg-accent-lime-100/70 border border-accent-lime-200/80 flex items-center justify-center shrink-0 mb-1.5 shadow-2xs">
                <XpStatIcon size={28} />
              </div>
              <div className="text-[11px] font-medium text-content-secondary">{UI_TEXT.xp}</div>
              <div className="text-xl font-black text-content-primary leading-tight my-0.5">
                {data.xp.toLocaleString()}
              </div>
              <div className="text-[11px] font-bold text-success-700">
                +{data.xpThisWeek.toLocaleString()} {UI_TEXT.thisWeek}
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-full bg-accent-orange-100/70 border border-accent-orange-200/80 flex items-center justify-center shrink-0 mb-1.5 shadow-2xs">
                <StreakFlameIcon size={28} />
              </div>
              <div className="text-[11px] font-medium text-content-secondary">{UI_TEXT.streak}</div>
              <div className="text-xl font-black text-content-primary leading-tight my-0.5">
                {data.streakDays} {UI_TEXT.days}
              </div>
              <div className="text-[11px] font-normal text-content-secondary">
                {UI_TEXT.keepItUp}
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-full bg-accent-purple-100/70 border border-accent-purple-200/80 flex items-center justify-center shrink-0 mb-1.5 shadow-2xs">
                <BadgeMedalIcon size={28} />
              </div>
              <div className="text-[11px] font-medium text-content-secondary">{UI_TEXT.badges}</div>
              <div className="text-xl font-black text-content-primary leading-tight my-0.5">
                {data.badgesCount}
              </div>
              <a
                href="#achievements"
                className="text-[11px] font-semibold text-brand-600 hover:underline"
              >
                {UI_TEXT.viewAll}
              </a>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
};
