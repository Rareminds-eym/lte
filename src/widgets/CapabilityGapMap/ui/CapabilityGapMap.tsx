import type React from "react";
import type { CapabilityGapItem, GapLevel } from "@/entities/dashboard";

export interface CapabilityGapMapProps {
  data: CapabilityGapItem[];
}

export const CapabilityGapMap: React.FC<CapabilityGapMapProps> = ({ data }) => {
  const getLevelBadge = (level: GapLevel) => {
    switch (level) {
      case "Developing":
        return "bg-level-developing-bg text-level-developing-text";
      case "Working Knowledge":
        return "bg-level-working-bg text-level-working-text";
      case "Foundation":
        return "bg-level-foundation-bg text-level-foundation-text";
      case "Proficient":
        return "bg-level-proficient-bg text-level-proficient-text";
      default:
        return "bg-surface-muted text-content-body";
    }
  };

  return (
    <div className="bg-surface-primary rounded-2xl border border-line-default p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-content-primary">Capability Gap Map</h2>
            <button
              type="button"
              aria-label="Capability information"
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
            href="#full-map"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
          >
            View full map →
          </a>
        </div>

        {/* Table / List Header */}
        <div className="grid grid-cols-3 text-[10px] font-extrabold text-content-muted uppercase tracking-wider pb-3 border-b border-line-subtle mb-3">
          <span>Capability</span>
          <span className="text-center">Current Level</span>
          <span className="text-center">Target Level</span>
        </div>

        {/* Rows */}
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.id} className="grid grid-cols-3 items-center">
              <span className="text-[13px] font-bold text-content-primary">{item.capability}</span>
              <div className="text-center">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold ${getLevelBadge(
                    item.currentLevel,
                  )}`}
                >
                  {item.currentLevel}
                </span>
              </div>
              <div className="text-center">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold ${getLevelBadge(
                    item.targetLevel,
                  )}`}
                >
                  {item.targetLevel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-5 border-t border-line-default mt-5">
        <a
          href="#level-guide"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
        >
          See how levels work →
        </a>
      </div>
    </div>
  );
};
