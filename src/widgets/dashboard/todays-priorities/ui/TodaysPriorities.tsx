import type React from "react";
import type { TodaysPrioritiesData } from "@/entities/dashboard";
import { DASHBOARD_CARD_HEIGHTS, ROUTES, UI_TEXT } from "@/shared/config";
import { WidgetCard } from "@/shared/ui";
import {
  ApiLatencyAnalysisIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  ClockIcon,
  DocumentIcon,
  KnowledgeCheckIcon,
  VisualHierarchyIcon,
} from "@/shared/ui/icons";

export interface TodaysPrioritiesProps {
  data: TodaysPrioritiesData;
}

export const TodaysPriorities: React.FC<TodaysPrioritiesProps> = ({ data }) => {
  return (
    <WidgetCard
      scrollable
      className={DASHBOARD_CARD_HEIGHTS.standard}
      title={UI_TEXT.todaySPriorities}
      icon={<CalendarIcon size={20} className="text-content-primary shrink-0" />}
      headerRight={
        <div className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-content-secondary font-medium">{UI_TEXT.dailyXpGoal}</span>
          <span className="font-extrabold text-brand-600">
            {data.currentXp} / {data.goalXp} {UI_TEXT.xp}
          </span>
        </div>
      }
      footer={
        <div className="text-center">
          <a
            href={ROUTES.MY_COURSES}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
          >
            {UI_TEXT.viewAllTasks}
            <ArrowRightIcon size={12} />
          </a>
        </div>
      }
    >
      {/* Priority Items List */}
      <div className="space-y-4">
        {!data.items.length && (
          <p className="text-sm text-content-secondary">{UI_TEXT.prioritiesEmptyDescription}</p>
        )}
        {data.items.map((item) => {
          const iconStyles = {
            green: "bg-success-50 text-success-700",
            purple: "bg-accent-purple-50 text-accent-purple-600",
            amber: "bg-accent-orange-50 text-accent-orange-600",
          }[item.type];

          return (
            <a
              href={ROUTES.MY_COURSES}
              key={item.id}
              className="flex @max-[12rem]/widget:flex-col items-start justify-between gap-2 group cursor-pointer rounded-lg min-h-11"
            >
              <div className="flex w-full items-start gap-3 min-w-0 pr-2">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconStyles}`}
                >
                  {item.id === "pri-1" && <ApiLatencyAnalysisIcon size={26} />}
                  {item.id !== "pri-1" && item.type === "green" && <DocumentIcon size={20} />}
                  {item.id === "pri-2" && <VisualHierarchyIcon size={26} />}
                  {item.id !== "pri-2" && item.type === "purple" && <BookOpenIcon size={20} />}
                  {item.id === "pri-3" && <KnowledgeCheckIcon size={26} />}
                  {item.id !== "pri-3" && item.type === "amber" && <ClipboardCheckIcon size={20} />}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-sm font-bold text-content-primary group-hover:text-brand-600 transition-colors leading-snug break-words">
                    {item.title}
                  </h3>
                  <p className="text-xs text-content-secondary font-medium truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 pt-0.5 flex flex-col items-end gap-1 @max-[12rem]/widget:pl-[3.25rem] @max-[12rem]/widget:flex-row @max-[12rem]/widget:items-center @max-[12rem]/widget:gap-3">
                <div className="flex items-center gap-1.5 text-xs text-content-secondary font-semibold">
                  <ClockIcon size={14} className="text-content-secondary" />
                  <span>{item.duration}</span>
                </div>
                <div className="text-xs font-bold text-brand-600">
                  +{item.xpReward} {UI_TEXT.xp}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </WidgetCard>
  );
};
