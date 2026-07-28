import type React from "react";
import type { AchievementsData } from "@/entities/dashboard";
import { Image } from "@/shared/ui";

export interface AchievementsProps {
  data: AchievementsData;
}

export const Achievements: React.FC<AchievementsProps> = ({ data }) => {
  const getBadgeImage = (iconType: string) => {
    switch (iconType) {
      case "project":
        return "/assets/images/badge_first_project.png";
      case "streak":
        return "/assets/images/badge_streak.png";
      case "api":
        return "/assets/images/badge_api_mastery.png";
      case "architect":
        return "/assets/images/badge_system_architect.png";
      default:
        return "/assets/images/badge_first_project.png";
    }
  };

  return (
    <div className="bg-surface-primary rounded-2xl border border-line-default p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-1">
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="w-5 h-5 text-content-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 3v4M3 5h4m12 0h4m-2-2v4m-5 8h-4m-6 4h14M7 8h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2z"
              />
            </svg>
            <h2 className="text-base font-bold text-content-primary">Achievements</h2>
          </div>

          <a
            href="#achievements"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            View all
          </a>
        </div>

        <p className="text-xs text-content-secondary font-medium mb-5">
          {data.unlockedCount} unlocked • {data.shownCount} shown
        </p>

        {/* 2x2 Grid of Badge Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-line-default bg-surface-primary hover:border-line-strong transition-colors cursor-pointer shadow-2xs"
            >
              <div className="w-[42px] h-[42px] shrink-0 overflow-hidden">
                <Image
                  src={getBadgeImage(item.iconType)}
                  alt={item.title}
                  loading="eager"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-xs font-bold text-content-primary truncate leading-tight">
                  {item.title}
                </h3>
                <p className="text-[10px] text-content-secondary font-medium truncate mt-0.5">
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Next Milestone Box */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-2">
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-content-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <span className="text-xs font-bold text-content-body">{data.nextMilestoneTitle}</span>
          </div>

          <p className="text-xs text-content-default font-medium leading-relaxed mb-3">
            {data.nextMilestoneDescription}
          </p>

          <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-brand-600 h-full rounded-full"
              style={{ width: `${data.nextMilestoneProgressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-5 mt-5 text-center">
        <a
          href="#all-achievements"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
        >
          View all achievements →
        </a>
      </div>
    </div>
  );
};
