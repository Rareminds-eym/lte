import type React from "react";
import type { RecommendedCareerPathsData } from "@/entities/dashboard";

export interface CareerPathsProps {
  data: RecommendedCareerPathsData;
}

// Hexagon geometry as a Tailwind arbitrary property (spaces encoded as underscores).
const hexClip = "[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]";

export const CareerPaths: React.FC<CareerPathsProps> = ({ data }) => {
  return (
    <div className="bg-surface-primary rounded-2xl border border-line-default p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line-default mb-2">
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
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <h2 className="text-base font-bold text-content-primary">Recommended Career Paths</h2>
          </div>

          <a
            href="#explore-paths"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            Explore all
          </a>
        </div>

        <p className="text-xs text-content-secondary mb-6 font-medium">
          AI-matched based on your skills, interests & trajectory
        </p>

        {/* Content Split: Left Track Explorer Honeycomb Diagram, Right Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Track Explorer Hexagon Diagram Box */}
          <div className="lg:col-span-5 border border-line-default rounded-xl p-4 bg-surface-primary flex flex-col items-center justify-between text-center min-h-[320px]">
            <div className="text-[11px] font-extrabold text-content-primary w-full text-center">
              Track Explorer
            </div>

            {/* Honeycomb Diagram Container */}
            <div className="relative w-full max-w-[245px] h-[220px] my-3 flex flex-col items-center justify-center -space-y-5">
              {/* Top Hexagon: Backend Engineering (Selected Dark Blue Node) */}
              <div
                className={`w-28 h-28 bg-brand-600 text-content-inverse flex flex-col items-center justify-center cursor-pointer hover:bg-brand-700 transition-colors z-10 ${hexClip}`}
              >
                <div className="mb-1 flex items-center justify-center">
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.872M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.72c2.206-.31 4.46-.47 6.75-.47s4.544.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"
                    />
                  </svg>
                </div>
                <div className="text-[11px] font-bold leading-tight max-w-[80px]">
                  Backend Engineering
                </div>
                <div className="text-[10px] font-semibold italic text-brand-200 mt-1">
                  45% Match
                </div>
              </div>

              {/* Bottom Row */}
              <div className="flex items-start justify-center gap-1.5 z-0">
                {/* Bottom Left Hexagon: Full-Stack Development (blue outline) */}
                <div className="relative w-28 h-28 group cursor-pointer">
                  <div className={`absolute inset-0 bg-brand-600 ${hexClip}`} />
                  <div
                    className={`absolute inset-[2px] bg-surface-primary group-hover:bg-surface-secondary transition-colors text-content-primary flex flex-col items-center justify-center text-center ${hexClip}`}
                  >
                    <div className="w-5 h-5 mb-1 flex items-center justify-center text-brand-600">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                    <div className="text-[10px] font-bold leading-tight text-content-heading max-w-[72px]">
                      Full-Stack Development
                    </div>
                    <div className="text-[10px] font-semibold italic text-brand-600 mt-1">
                      25% Match
                    </div>
                  </div>
                </div>

                {/* Bottom Right Hexagon: DevOps & Platform Engineering (gray outline) */}
                <div className="relative w-28 h-28 group cursor-pointer">
                  <div className={`absolute inset-0 bg-line-default ${hexClip}`} />
                  <div
                    className={`absolute inset-[2px] bg-surface-primary group-hover:bg-surface-secondary transition-colors text-content-primary flex flex-col items-center justify-center text-center ${hexClip}`}
                  >
                    <div className="w-5 h-5 mb-1 flex items-center justify-center text-content-secondary">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.5 8.5l-2 5-5 2 2-5 5-2z"
                        />
                      </svg>
                    </div>
                    <div className="text-[9px] font-bold leading-tight text-content-heading max-w-[76px]">
                      DevOps & Platform Engineering
                    </div>
                    <div className="text-[9px] font-medium text-content-muted mt-1">
                      Explore Path
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="w-full py-2 bg-surface-primary border border-line-default hover:border-line-strong text-brand-600 text-[11px] font-bold rounded-full transition-colors cursor-pointer shadow-2xs mt-4"
            >
              View Path →
            </button>
          </div>

          {/* Right Rationale & Stats Pane */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <p className="text-[13px] text-content-default leading-relaxed font-medium">
              {data.description}
            </p>

            {/* Callout Box */}
            <div className="p-4 bg-surface-subtle border border-line-default/80 rounded-xl space-y-1.5">
              <div className="text-[10px] font-extrabold text-content-muted uppercase tracking-wider">
                WHY IT FITS
              </div>
              <p className="text-[13px] text-content-default leading-relaxed font-medium">
                {data.whyItFits}
              </p>
            </div>

            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="text-[10px] font-extrabold text-brand-600 uppercase tracking-wider">
                OVERALL PROGRESS
              </div>
              <div className="w-full bg-surface-emphasis rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full"
                  style={{ width: `${data.overallProgress}%` }}
                />
              </div>
            </div>

            {/* 3 Metrics Columns */}
            <div className="grid grid-cols-3 gap-2 text-center pt-2 pb-1">
              <div>
                <div className="text-lg font-extrabold text-content-primary">
                  {data.capabilitiesCount}
                </div>
                <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider">
                  CAPABILITIES
                </div>
              </div>
              <div>
                <div className="text-lg font-extrabold text-content-primary">
                  {data.competitionCount}
                </div>
                <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider">
                  COMPETITION
                </div>
              </div>
              <div>
                <div className="text-lg font-extrabold text-success-600">
                  {data.marketStatusPercentage}%
                </div>
                <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider">
                  MARKET STATUS
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="button"
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-content-inverse text-sm font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <span>Curriculum Analysis</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-5 mt-5 text-[11px] text-content-secondary font-medium">
        Based on your activity in{" "}
        <span className="font-bold text-content-body">Backend Engineering</span>
      </div>
    </div>
  );
};
