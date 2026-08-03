import type React from "react";
import { SegmentedProgressBar } from "@/shared/ui";
import { ArtifactsIcon, CertificateIcon, DurationIcon, ModulesIcon } from "@/shared/ui/icons";

interface LevelStatsBarProps {
  totalDuration?: string;
  modulesCount?: number;
  artifactsCount?: number;
  hasCertificate?: boolean;
  currentLevelNo: number;
  totalLevelsNo: number;
  targetLevel?: string;
}

export const LevelStatsBar: React.FC<LevelStatsBarProps> = ({
  totalDuration = "0 hrs",
  modulesCount = 0,
  artifactsCount = 0,
  hasCertificate = false,
  currentLevelNo,
  totalLevelsNo,
  targetLevel = "L1",
}) => {
  const normalizedTargetLevel = targetLevel.replace(/^target:\s*/i, "");

  return (
    <div className="w-full bg-white rounded-2xl border border-border-default p-4 sm:p-6 shadow-xl -mt-10 sm:-mt-12 relative z-20 mx-auto max-w-[96%] sm:max-w-[98%]">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6">
        {/* Left Side: 4 Core Stat Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 flex-1 sm:divide-x sm:divide-border-default">
          {/* Stat 1: Duration */}
          <div className="flex items-center gap-3 sm:gap-3.5 sm:px-4 sm:first:pl-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <DurationIcon size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-content-primary">{totalDuration}</div>
              <div className="text-xs text-content-secondary font-medium">Total duration</div>
            </div>
          </div>

          {/* Stat 2: Modules */}
          <div className="flex items-center gap-3 sm:gap-3.5 sm:px-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <ModulesIcon size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-content-primary">{modulesCount}</div>
              <div className="text-xs text-content-secondary font-medium">Modules</div>
            </div>
          </div>

          {/* Stat 3: Artifacts */}
          <div className="flex items-center gap-3 sm:gap-3.5 sm:px-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <ArtifactsIcon size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-content-primary">{artifactsCount}</div>
              <div className="text-xs text-content-secondary font-medium">Artifacts</div>
            </div>
          </div>

          {/* Stat 4: Certificate */}
          <div className="flex items-center gap-3 sm:gap-3.5 sm:px-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <CertificateIcon size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-content-primary">
                {hasCertificate ? "Included" : "None"}
              </div>
              <div className="text-xs text-content-secondary font-medium">Certificate</div>
            </div>
          </div>
        </div>

        {/* Right Side: Level Track Segments & Target Badge */}
        <div className="xl:border-l xl:border-border-default xl:pl-8 flex flex-col justify-center min-w-[260px] pt-4 xl:pt-0 border-t xl:border-t-0 border-border-default/60">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-content-primary">
              Level {currentLevelNo} of {totalLevelsNo}
            </span>
            <span className="text-content-secondary tracking-wider">
              Target: {normalizedTargetLevel}
            </span>
          </div>

          {/* Segmented Track Indicator Bar */}
          <SegmentedProgressBar
            currentLevel={currentLevelNo}
            totalLevels={totalLevelsNo}
            heightClassName="h-2.5"
            gapClassName="gap-1.5"
            barColor="bg-brand-600"
            emptyColor="bg-surface-emphasis"
            ariaLabel={`Level progress: ${currentLevelNo} of ${totalLevelsNo}`}
          />
        </div>
      </div>
    </div>
  );
};
