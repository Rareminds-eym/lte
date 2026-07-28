import type React from "react";
import type { TodaysPrioritiesData } from "@/entities/dashboard";
import { WidgetCard } from "@/shared/ui";

export interface TodaysPrioritiesProps {
  data: TodaysPrioritiesData;
}

export const TodaysPriorities: React.FC<TodaysPrioritiesProps> = ({ data }) => {
  return (
    <WidgetCard
      title="Today's Priorities"
      icon={
        <svg
          aria-hidden="true"
          className="w-5 h-5 text-content-body"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      }
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
            View all tasks →
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
                  {item.type === "green" && (
                    <svg
                      aria-hidden="true"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
                  {item.type === "purple" && (
                    <svg
                      aria-hidden="true"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  )}
                  {item.type === "amber" && (
                    <svg
                      aria-hidden="true"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  )}
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
                  <svg
                    aria-hidden="true"
                    className="w-3.5 h-3.5 text-content-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
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
