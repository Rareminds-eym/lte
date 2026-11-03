import type React from "react";
import { useState } from "react";
import type { AchievementItem, AchievementsData } from "@/entities/dashboard";
import { ACHIEVEMENT_IMAGES, DASHBOARD_CARD_HEIGHTS, UI_TEXT } from "@/shared/config";
import { toPercentage } from "@/shared/lib";
import { Dialog, Image, WidgetCard } from "@/shared/ui";
import { ArrowRightIcon, ConcentricTargetIcon, TrophyIcon } from "@/shared/ui/icons";

export interface AchievementsProps {
  data: AchievementsData;
}

export const Achievements: React.FC<AchievementsProps> = ({ data }) => {
  const [detail, setDetail] = useState<AchievementItem | "all" | null>(null);

  return (
    <>
      <WidgetCard
        scrollable
        className={DASHBOARD_CARD_HEIGHTS.achievements}
        title={UI_TEXT.achievements}
        subtitle={UI_TEXT.achievementCounts(data.unlockedCount, data.shownCount)}
        icon={<TrophyIcon size={20} className="text-content-primary" />}
        action={{
          label: UI_TEXT.viewAll,
          onClick: () => setDetail("all"),
        }}
        footer={
          <div className="text-center">
            <button
              type="button"
              onClick={() => setDetail("all")}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              {UI_TEXT.viewAllAchievements}
              <ArrowRightIcon size={12} />
            </button>
          </div>
        }
      >
        {/* Badge grid adapts to the available card width. */}
        <div className="grid grid-cols-2 @max-[15rem]/widget:grid-cols-1 gap-3 mb-6">
          {data.items.map((item) => (
            <button
              type="button"
              onClick={() => setDetail(item)}
              aria-label={UI_TEXT.viewAchievement(item.title)}
              key={item.id}
              className="flex flex-col @[18rem]/widget:flex-row @max-[15rem]/widget:flex-row items-start @[18rem]/widget:items-center @max-[15rem]/widget:items-center gap-3 p-3 rounded-xl border border-line-default bg-surface-primary hover:border-line-strong transition-colors cursor-pointer shadow-2xs text-left min-w-0"
            >
              <div className="w-[42px] h-[42px] shrink-0 overflow-hidden">
                <Image
                  src={ACHIEVEMENT_IMAGES[item.iconType] || ACHIEVEMENT_IMAGES["project"]}
                  alt=""
                  width={42}
                  height={42}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 w-full pt-0.5">
                <h3 className="text-xs font-bold text-content-primary break-words leading-tight">
                  {item.title}
                </h3>
                <p className="text-xs text-content-secondary font-medium break-words mt-0.5">
                  {item.subtitle}
                </p>
              </div>
            </button>
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

          <div
            role="progressbar"
            aria-label={UI_TEXT.nextMilestoneProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={toPercentage(data.nextMilestoneProgressPercentage)}
            className="w-full bg-surface-emphasis rounded-full h-2 overflow-hidden"
          >
            <div
              className="bg-brand-600 h-full rounded-full"
              style={{ width: `${toPercentage(data.nextMilestoneProgressPercentage)}%` }}
            />
          </div>
        </div>
      </WidgetCard>
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail && detail !== "all" ? detail.title : UI_TEXT.achievements}
      >
        <p className="mb-4 text-sm text-content-secondary">
          {detail === "all"
            ? UI_TEXT.availableAchievementDetails(data.unlockedCount, data.items.length)
            : UI_TEXT.achievementDetails}
        </p>
        <div className="space-y-3">
          {(detail === "all" ? data.items : detail ? [detail] : []).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-xl border border-line-default p-4"
            >
              <Image
                src={ACHIEVEMENT_IMAGES[item.iconType]}
                alt=""
                width={56}
                height={56}
                className="w-14 h-14 object-contain shrink-0"
              />
              <div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-content-secondary">{item.subtitle}</p>
              </div>
            </div>
          ))}
          {!data.items.length && (
            <p className="text-sm text-content-secondary">{UI_TEXT.achievementEmptyDescription}</p>
          )}
        </div>
      </Dialog>
    </>
  );
};
