import type React from "react";
import { useState } from "react";
import type { CapabilityGapItem, GapLevel } from "@/entities/dashboard";
import { CAPABILITY_LEVEL_DESCRIPTIONS, DASHBOARD_CARD_HEIGHTS, UI_TEXT } from "@/shared/config";
import { Dialog, WidgetCard } from "@/shared/ui";
import { AnalysisIcon, ArrowRightIcon } from "@/shared/ui/icons";

export interface CapabilityGapMapProps {
  data: CapabilityGapItem[];
}

export const CapabilityGapMap: React.FC<CapabilityGapMapProps> = ({ data }) => {
  const [detail, setDetail] = useState<"map" | "levels" | null>(null);
  const LEVEL_BADGES: Record<GapLevel, string> = {
    Developing: "bg-level-developing-bg text-warning-700",
    "Working Knowledge": "bg-level-working-bg text-level-working-text",
    Foundation: "bg-level-foundation-bg text-level-foundation-text",
    Proficient: "bg-level-proficient-bg text-level-proficient-text",
  };

  return (
    <>
      <WidgetCard
        scrollable
        className={DASHBOARD_CARD_HEIGHTS.standard}
        icon={<AnalysisIcon size={20} className="text-content-primary" />}
        title={UI_TEXT.capabilityGapMap}
        infoTooltip={UI_TEXT.capabilityMapTooltip}
        action={{
          label: UI_TEXT.viewFullMap,
          onClick: () => setDetail("map"),
        }}
        footer={
          <button
            type="button"
            onClick={() => setDetail("levels")}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            {UI_TEXT.seeHowLevelsWork}
            <ArrowRightIcon size={12} />
          </button>
        }
      >
        {/* Table / List Header */}
        <table aria-label={UI_TEXT.capabilityLevels} className="w-full table-fixed text-left">
          <thead className="text-xs font-extrabold text-content-secondary uppercase tracking-wider border-b border-line-subtle">
            <tr>
              <th scope="col" className="w-[40%] pb-3 pt-1 pr-2">
                {UI_TEXT.capability}
              </th>
              <th scope="col" className="w-[34%] pb-3 pt-1 px-1 text-center">
                {UI_TEXT.currentLevel}
              </th>
              <th scope="col" className="w-[26%] pb-3 pt-1 pl-1 text-center">
                {UI_TEXT.targetLevel}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td className="text-xs @[20rem]/widget:text-sm font-bold text-content-primary break-words py-2 pr-2">
                  {item.capability}
                </td>
                <td className="text-center py-2 px-1">
                  <span
                    className={`inline-block max-w-full break-words px-1 @[20rem]/widget:px-3 py-1 rounded-full text-[11px] @[20rem]/widget:text-xs font-bold ${LEVEL_BADGES[item.currentLevel]}`}
                  >
                    {item.currentLevel}
                  </span>
                </td>
                <td className="text-center py-2 pl-1">
                  <span
                    className={`inline-block max-w-full break-words px-1 @[20rem]/widget:px-3 py-1 rounded-full text-[11px] @[20rem]/widget:text-xs font-bold ${LEVEL_BADGES[item.targetLevel]}`}
                  >
                    {item.targetLevel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && (
          <p className="text-sm text-content-secondary">{UI_TEXT.capabilityEmptyDescription}</p>
        )}
      </WidgetCard>
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail === "map" ? UI_TEXT.capabilityGapMap : UI_TEXT.howCapabilityLevelsWork}
      >
        {detail === "map" ? (
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">
              {UI_TEXT.capabilityComparisonDescription}
            </p>
            {data.map((item) => (
              <div key={item.id} className="rounded-xl border border-line-default p-4">
                <h3 className="font-semibold">{item.capability}</h3>
                <p className="mt-1 text-sm text-content-secondary">
                  {UI_TEXT.capabilityComparison(item.currentLevel, item.targetLevel)}
                </p>
              </div>
            ))}
            {!data.length && (
              <p className="text-sm text-content-secondary">
                {UI_TEXT.noCapabilityLevelsAvailableYet}
              </p>
            )}
          </div>
        ) : (
          <dl className="space-y-4 text-sm">
            {CAPABILITY_LEVEL_DESCRIPTIONS.map(([level, description]) => (
              <div key={level}>
                <dt className="font-semibold">{level}</dt>
                <dd className="mt-1 text-content-secondary">{description}</dd>
              </div>
            ))}
          </dl>
        )}
      </Dialog>
    </>
  );
};
