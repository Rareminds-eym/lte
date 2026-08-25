import type React from "react";
import type { TodaysPrioritiesData } from "@/entities/dashboard";
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
      title="Today's Priorities"
      icon={<CalendarIcon size={20} className="text-content-primary shrink-0" />}
      headerRight={
        <div className="text-xs flex items-center gap-2">
          <span className="text-content-secondary font-medium">Daily XP Goal</span>
          <span className="font-extrabold text-brand-600">
            {data.currentXp} / {data.goalXp} XP
          </span>
        </div>
      }
      footer={
        <div className="text-center">
          <a
            href="#tasks"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
          >
            View all tasks <ArrowRightIcon size={12} />
          </a>
        </div>
      }
    >
      {/* Priority Items List */}
      <div className="space-y-4">
        {data.items.map((item) => {
          const iconStyles = {
            green: "bg-success-50 text-success-600",
            purple: "bg-accent-purple-50 text-accent-purple-600",
            amber: "bg-accent-orange-50 text-accent-orange-600",
          }[item.type];

          return (
            <div key={item.id} className="flex items-start justify-between group cursor-pointer">
              <div className="flex items-start gap-3 min-w-0 pr-2">
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
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-sm font-bold text-content-primary group-hover:text-brand-600 transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-content-secondary font-medium truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 pt-0.5 flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-xs text-content-secondary font-semibold">
                  <ClockIcon size={14} className="text-content-muted" />
                  <span>{item.duration}</span>
                </div>
                <div className="text-xs font-bold text-brand-600">+{item.xpReward} XP</div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
};
