import type React from "react";
import type { CapabilityGapItem, GapLevel } from "@/entities/dashboard";
import { WidgetCard } from "@/shared/ui";

export interface CapabilityGapMapProps {
  data: CapabilityGapItem[];
}

export const CapabilityGapMap: React.FC<CapabilityGapMapProps> = ({ data }) => {
  const LEVEL_BADGES: Record<GapLevel, string> = {
    Developing: "bg-level-developing-bg text-level-developing-text",
    "Working Knowledge": "bg-level-working-bg text-level-working-text",
    Foundation: "bg-level-foundation-bg text-level-foundation-text",
    Proficient: "bg-level-proficient-bg text-level-proficient-text",
  };

  return (
    <WidgetCard
      title="Capability Gap Map"
      infoTooltip="Capability information"
      action={{
        label: "View full map",
        href: "#full-map",
      }}
      footer={
        <a
          href="#level-guide"
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
        >
          See how levels work →
        </a>
      }
    >
      {/* Table / List Header */}
      <div className="grid grid-cols-3 text-xs font-extrabold text-content-muted uppercase tracking-wider pb-3 border-b border-line-subtle mb-3 pt-1">
        <span>Capability</span>
        <span className="text-center">Current Level</span>
        <span className="text-center">Target Level</span>
      </div>

      {/* Rows */}
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.id} className="grid grid-cols-3 items-center">
            <span className="text-sm font-bold text-content-primary">{item.capability}</span>
            <div className="text-center">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${LEVEL_BADGES[item.currentLevel]}`}
              >
                {item.currentLevel}
              </span>
            </div>
            <div className="text-center">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${LEVEL_BADGES[item.targetLevel]}`}
              >
                {item.targetLevel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};
