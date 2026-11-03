import type React from "react";
import { useNavigate } from "react-router-dom";
import type { CurrentJourneyData, JourneyState } from "@/entities/dashboard";
import {
  DASHBOARD_CARD_HEIGHTS,
  ROUTES,
  routeForLevel,
  routeForModule,
  UI_TEXT,
} from "@/shared/config";
import { toPercentage } from "@/shared/lib";
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
      <section
        aria-label={UI_TEXT.journeyProgressLabel}
        className={`relative bg-surface-hero [&_button:focus-visible]:outline-content-inverse [&_a:focus-visible]:outline-content-inverse [&_[tabindex]:focus-visible]:outline-content-inverse text-content-inverse rounded-2xl p-6 lg:p-8 overflow-hidden shadow-lg flex flex-col ${DASHBOARD_CARD_HEIGHTS.journey}`}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[340px] h-[340px] opacity-20 pointer-events-none translate-x-0">
          <Image
            src="/assets/images/mesh_orb.png"
            alt=""
            priority
            className="w-full h-full object-contain"
          />
        </div>
        <div className="relative z-10 min-h-0 flex-auto flex flex-col max-w-[640px]">
          <header className="mb-6 shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-content-on-dark-muted mb-2">
              {UI_TEXT.continueYourJourney}
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-content-inverse">
              {state === "completed"
                ? UI_TEXT.journeyCompletedTitle
                : UI_TEXT.yourJourneyStartsHere}
            </h1>
            <p className="text-sm text-content-on-dark-muted mt-2 leading-relaxed">
              {state === "completed"
                ? UI_TEXT.journeyCompletedDescription
                : UI_TEXT.journeyEmptyDescription}
            </p>
          </header>
          <section
            aria-label={UI_TEXT.cardContent(UI_TEXT.journeyProgressLabel)}
            /* biome-ignore lint/a11y/noNoninteractiveTabindex: Labelled scroll regions need keyboard focus for overflow content. */
            tabIndex={0}
            className="min-h-0 flex-auto overflow-x-hidden overflow-y-auto"
          >
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate(ROUTES.MY_COURSES)}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-content-inverse font-semibold text-sm rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                {state === "completed"
                  ? UI_TEXT.chooseNextCapability
                  : UI_TEXT.exploreCareerPathsAction}
                <ArrowRightIcon size={16} />
              </button>
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={UI_TEXT.journeyProgressLabel}
      className={`relative bg-surface-hero [&_button:focus-visible]:outline-content-inverse [&_a:focus-visible]:outline-content-inverse [&_[tabindex]:focus-visible]:outline-content-inverse text-content-inverse rounded-2xl p-6 lg:p-8 overflow-hidden shadow-lg flex flex-col ${DASHBOARD_CARD_HEIGHTS.journey}`}
    >
      {/* Background Graphic: 3D Orb Mesh using shared Image component */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[340px] h-[340px] opacity-20 pointer-events-none translate-x-0">
        <Image
          src="/assets/images/mesh_orb.png"
          alt=""
          loading="eager"
          priority
          className="w-full h-full object-contain"
        />
      </div>

      <div className="relative z-10 min-h-0 flex-auto flex flex-col max-w-[640px] min-w-0">
        {/* Top Header */}
        <header className="mb-6 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-content-on-dark-muted mb-2">
            {UI_TEXT.continueYourJourney}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <h1
              title={data.title}
              className="min-w-0 line-clamp-2 text-2xl lg:text-3xl font-extrabold tracking-tight text-content-inverse break-words"
            >
              {data.title}
            </h1>
            <span className="px-3 py-1 text-xs font-semibold bg-surface-hero-elevated text-content-on-dark rounded-full">
              {data.moduleInfo}
            </span>
          </div>
        </header>

        <section
          aria-label={UI_TEXT.cardContent(UI_TEXT.journeyProgressLabel)}
          /* biome-ignore lint/a11y/noNoninteractiveTabindex: Labelled scroll regions need keyboard focus for overflow content. */
          tabIndex={0}
          className="min-h-0 flex-auto overflow-x-hidden overflow-y-auto"
        >
          <div className="space-y-6">
            {/* Specs Grid */}
            <div className="grid grid-cols-1 gap-4 pt-2 lg:grid-cols-3 lg:gap-6">
              {[
                {
                  label: UI_TEXT.capability,
                  value: data.capability,
                  clampClass: "line-clamp-2",
                  icon: (
                    <BrainIcon size={14} className="text-content-on-dark-muted shrink-0 mt-1" />
                  ),
                },
                {
                  label: UI_TEXT.output,
                  value: data.output,
                  clampClass: "line-clamp-2",
                  icon: (
                    <DocumentIcon size={14} className="text-content-on-dark-muted shrink-0 mt-1" />
                  ),
                },
                {
                  label: UI_TEXT.whyItMatters,
                  value: data.whyItMatters,
                  clampClass: "line-clamp-3",
                  icon: (
                    <LightbulbIcon size={14} className="text-content-on-dark-muted shrink-0 mt-1" />
                  ),
                },
              ].map((item) => (
                <div key={item.label} className="flex min-w-0 items-start gap-2.5">
                  {item.icon}
                  <div className="min-w-0">
                    <div className="text-[10px] text-content-on-dark-muted font-medium">
                      {item.label}
                    </div>
                    <div
                      className={`text-sm font-semibold text-content-inverse mt-0.5 leading-snug break-words ${item.clampClass ?? ""}`}
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
                <span>{UI_TEXT.journeyProgress}</span>
                <span className="text-base font-extrabold text-content-inverse">
                  {toPercentage(data.progressPercentage)}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-label={UI_TEXT.journeyProgressLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={toPercentage(data.progressPercentage)}
                className="w-full bg-surface-hero-elevated/50 rounded-full h-2 overflow-hidden"
              >
                <div
                  className="bg-success-500 h-full rounded-full"
                  style={{ width: `${toPercentage(data.progressPercentage)}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-content-on-dark-muted pt-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success-500 inline-block" />
                    <span className="text-content-on-dark">
                      {data.completedCount} {UI_TEXT.completed}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" />
                    <span className="text-content-on-dark">
                      {data.inProgressCount} {UI_TEXT.inProgress}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-content-on-dark-subtle inline-block" />
                    <span className="text-content-on-dark">
                      {data.remainingCount} {UI_TEXT.remaining}
                    </span>
                  </span>
                </div>
                {data.timeRemaining && (
                  <div className="flex items-center gap-1.5">
                    <ClockIcon size={14} />
                    <span>{data.timeRemaining}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <button
                type="button"
                disabled={!continueUrl}
                onClick={() => continueUrl && navigate(continueUrl)}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-content-inverse font-semibold text-sm rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{UI_TEXT.continueChallenge}</span>
                <ArrowRightIcon size={16} />
              </button>
              <button
                type="button"
                disabled={!detailsUrl}
                onClick={() => detailsUrl && navigate(detailsUrl)}
                className="px-6 py-2.5 bg-surface-hero-button hover:bg-surface-hero-elevated text-content-on-dark font-semibold text-sm rounded-lg border border-surface-hero-elevated transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {UI_TEXT.viewDetails}
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};
