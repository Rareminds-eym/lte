import type React from "react";
import type { AchievementsData } from "@/entities/dashboard";
import { Image, WidgetCard } from "@/shared/ui";
import { ArrowRightIcon, ConcentricTargetIcon, TrophyIcon } from "@/shared/ui/icons";

export interface AchievementsProps {
  data: AchievementsData;
}

export const Achievements: React.FC<AchievementsProps> = ({ data }) => {
  const BADGE_IMAGES: Record<string, string> = {
    project: "/assets/images/badge_first_project.png",
    streak: "/assets/images/badge_streak.png",
    api: "/assets/images/badge_api_mastery.png",
    architect: "/assets/images/badge_system_architect.png",
  };

  return (
    <WidgetCard
      title="Achievements"
      subtitle={`${data.unlockedCount} unlocked • ${data.shownCount} shown`}
      icon={<TrophyIcon size={20} className="text-content-primary" />}
      action={{
        label: "View all",
        href: "#achievements",
      }}
      footer={
        <div className="text-center">
          <a
            href="#all-achievements"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
          >
            View all achievements <ArrowRightIcon size={12} />
          </a>
        </div>
      }
    >
      {/* 2x2 Grid of Badge Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {data.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-line-default bg-surface-primary hover:border-line-strong transition-colors cursor-pointer shadow-2xs"
          >
            <div className="w-[42px] h-[42px] shrink-0 overflow-hidden">
              <Image
                src={BADGE_IMAGES[item.iconType] || BADGE_IMAGES["project"]}
                alt={item.title}
                loading="eager"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-xs font-bold text-content-primary truncate leading-tight">
                {item.title}
              </h3>
              <p className="text-xs text-content-secondary font-medium truncate mt-0.5">
                {item.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Next Milestone Box */}
      <div className="p-4 bg-surface-secondary border border-line-default rounded-xl space-y-2 mt-auto">
        <div className="flex items-center gap-2 mb-1">
          <ConcentricTargetIcon size={16} className="text-content-secondary shrink-0" />
          <span className="text-xs font-bold text-content-body">{data.nextMilestoneTitle}</span>
        </div>

        <p className="text-xs text-content-default font-medium leading-relaxed">
          {data.nextMilestoneDescription}
        </p>

        <div className="w-full bg-surface-emphasis rounded-full h-2 overflow-hidden pt-0.5">
          <div
            className="bg-brand-600 h-full rounded-full"
            style={{ width: `${data.nextMilestoneProgressPercentage}%` }}
          />
        </div>
      </div>
    </WidgetCard>
  );
};
