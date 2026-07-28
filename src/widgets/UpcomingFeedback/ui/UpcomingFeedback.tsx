import type React from "react";
import type { UpcomingFeedbackData } from "@/entities/dashboard";

export interface UpcomingFeedbackProps {
  data: UpcomingFeedbackData;
}

export const UpcomingFeedback: React.FC<UpcomingFeedbackProps> = ({ data }) => {
  return (
    <div className="bg-surface-primary rounded-2xl border border-line-default p-6 shadow-xs flex flex-col justify-between h-full">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line-default">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-content-primary">Upcoming & Feedback</h2>
            <button
              type="button"
              aria-label="Upcoming events info"
              className="text-content-muted hover:text-content-default transition-colors cursor-pointer"
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>

          <a
            href="#calendar"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
          >
            View calendar →
          </a>
        </div>

        {/* Section 1: UPCOMING */}
        <div>
          <div className="text-[10px] font-extrabold text-content-muted uppercase tracking-wider mb-3">
            UPCOMING
          </div>
          <div className="space-y-4">
            {data.upcoming.map((item) => (
              <div key={item.id} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-start gap-3 min-w-0 pr-2">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === "education"
                        ? "bg-level-working-bg text-level-working-text"
                        : "bg-accent-purple-100 text-accent-purple-700"
                    }`}
                  >
                    {item.type === "education" ? (
                      <svg
                        aria-hidden="true"
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path
                          d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
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
                          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-bold text-content-primary group-hover:text-brand-600 transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-content-secondary font-medium truncate mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 bg-surface-muted text-content-body text-[10px] font-bold rounded-full shrink-0">
                  {item.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: RECENT FEEDBACK */}
        <div>
          <div className="text-[10px] font-extrabold text-content-muted uppercase tracking-wider mb-3">
            RECENT FEEDBACK
          </div>
          <div className="space-y-4">
            {data.recentFeedback.map((item) => (
              <div key={item.id} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-start gap-3 min-w-0 pr-2">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === "interview"
                        ? "bg-level-developing-bg text-level-developing-text"
                        : "bg-level-proficient-bg text-level-proficient-text"
                    }`}
                  >
                    {item.type === "interview" ? (
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
                          d="M5 3v4M3 5h4m12 0h4m-2-2v4m-5 8h-4m-6 4h14M7 8h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2z"
                        />
                      </svg>
                    ) : (
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
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-sm font-bold text-content-primary group-hover:text-brand-600 transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-content-secondary font-medium truncate mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-content-secondary font-medium shrink-0 pt-0.5">
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{item.daysAgo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
