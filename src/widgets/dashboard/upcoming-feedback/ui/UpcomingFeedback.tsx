import type React from "react";
import { Link } from "react-router-dom";
import type { UpcomingFeedbackData } from "@/entities/dashboard";
import { WidgetCard } from "@/shared/ui";
import {
  CalendarIcon,
  GoodFeedbackIcon,
  GraduationCapIcon,
  MonitorIcon,
  PortfolioIcon,
  TrophyIcon,
} from "@/shared/ui/icons";

export interface UpcomingFeedbackProps {
  data: UpcomingFeedbackData;
}

export const UpcomingFeedback: React.FC<UpcomingFeedbackProps> = ({ data }) => {
  return (
    <WidgetCard
      title="Upcoming & Feedback"
      infoTooltip="Upcoming events info"
      icon={<GoodFeedbackIcon size={18} className="text-content-primary shrink-0" />}
    >
      <div className="space-y-5">
        {data.error && (
          <p role="alert" className="text-sm text-content-secondary">
            {data.error}
          </p>
        )}
        {/* Section 1: UPCOMING */}
        <div>
          <div className="text-xs font-extrabold text-content-muted uppercase tracking-wider mb-3">
            UPCOMING
          </div>
          <div className="space-y-4">
            {!data.error && !data.upcoming.length && (
              <p className="text-sm text-content-secondary">No staff reviews pending.</p>
            )}
            {data.upcoming.map((item) => (
              <Link
                key={item.id}
                to={item.href ?? "/my-courses"}
                className="flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-start gap-3.5 min-w-0 pr-2">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === "education"
                        ? "bg-level-working-bg text-level-working-text"
                        : "bg-accent-purple-100 text-accent-purple-700"
                    }`}
                  >
                    {item.type === "education" ? (
                      <GraduationCapIcon size={20} />
                    ) : (
                      <PortfolioIcon size={20} />
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

                <span className="px-3 py-1 bg-surface-secondary text-content-secondary text-xs font-semibold rounded-full shrink-0 shadow-2xs">
                  {item.tag}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Section Divider Line */}
        <div className="border-b border-line-subtle/80 pt-1" />

        {/* Section 2: RECENT FEEDBACK */}
        <div>
          <div className="text-xs font-extrabold text-content-muted uppercase tracking-wider mb-3">
            RECENT FEEDBACK
          </div>
          <div className="space-y-4">
            {!data.error && !data.recentFeedback.length && (
              <p className="text-sm text-content-secondary">No staff feedback yet.</p>
            )}
            {data.recentFeedback.map((item) => (
              <Link
                key={item.id}
                to={item.href ?? "/my-courses"}
                className="flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-start gap-3.5 min-w-0 pr-2">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === "interview"
                        ? "bg-level-developing-bg text-level-developing-text"
                        : "bg-level-proficient-bg text-level-proficient-text"
                    }`}
                  >
                    {item.type === "interview" ? (
                      <TrophyIcon size={20} />
                    ) : (
                      <MonitorIcon size={20} />
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

                <div className="flex items-center gap-1.5 text-xs text-content-secondary font-semibold shrink-0 pt-0.5">
                  <CalendarIcon size={14} />
                  <span>{item.daysAgo}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
};
