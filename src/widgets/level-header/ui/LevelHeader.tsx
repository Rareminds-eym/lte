import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { LteStage } from "@/entities/course";
import {
  ArrowLeftIcon,
  BeakerIcon,
  Breadcrumb,
  CodeBracketsIcon,
  DotsVerticalIcon,
  FlagIcon,
  LayerStackIcon,
  LightbulbIcon,
  LightningBoltIcon,
  PanelLeftIcon,
  PanelRightIcon,
  ShareLinkIcon,
  TrendingArrowIcon,
} from "@/shared/ui";

export interface LevelHeaderProps {
  levelTitle: string;
  activeStage?: LteStage;
  onBackClick?: () => void;
  onOverviewClick?: () => void;
  isModulesOpen?: boolean;
  isStageInfoOpen?: boolean;
  onToggleModules?: () => void;
  onToggleStageInfo?: () => void;
  onShareLink?: () => void;
  onReportIssue?: () => void;
  className?: string;
}

const STAGE_CONFIG: Record<
  LteStage,
  { label: string; icon: React.FC<{ size?: number; className?: string }> }
> = {
  engage: { label: "Engage", icon: LightbulbIcon },
  explore: { label: "Explore", icon: BeakerIcon },
  explain: { label: "Explain", icon: LayerStackIcon },
  express: { label: "Express", icon: CodeBracketsIcon },
  empower: { label: "Empower", icon: LightningBoltIcon },
  evolve: { label: "Evolve", icon: TrendingArrowIcon },
};

export const LevelHeader: React.FC<LevelHeaderProps> = ({
  levelTitle,
  activeStage = "engage",
  onBackClick,
  onOverviewClick,
  isModulesOpen = true,
  isStageInfoOpen = true,
  onToggleModules,
  onToggleStageInfo,
  onShareLink,
  onReportIssue,
  className = "",
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentStageConfig = STAGE_CONFIG[activeStage] || STAGE_CONFIG.engage;
  const StageIconComponent = currentStageConfig.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleShare = () => {
    setIsMenuOpen(false);
    if (onShareLink) {
      onShareLink();
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleReport = () => {
    setIsMenuOpen(false);
    onReportIssue?.();
  };

  const breadcrumbItems = [
    {
      label: "Overview",
      onClick: onOverviewClick || onBackClick,
    },
    {
      label: levelTitle,
      hideOnMobile: true,
    },
    {
      label: currentStageConfig.label,
      icon: <StageIconComponent size={14} className="text-brand-600 shrink-0" />,
    },
  ];

  return (
    <div
      className={`h-12 md:h-14 bg-surface-primary border-b border-line-subtle px-3 md:px-6 flex items-center justify-between shrink-0 select-none ${className}`}
    >
      {/* Left Navigation Breadcrumb */}
      <Breadcrumb
        items={breadcrumbItems}
        leadingIcon={
          <button
            type="button"
            onClick={onBackClick || onOverviewClick}
            aria-label="Back to overview"
            className="p-1 rounded-md text-content-secondary hover:text-content-primary hover:bg-surface-muted transition-colors cursor-pointer inline-flex items-center shrink-0 border-none bg-transparent"
          >
            <ArrowLeftIcon size={14} />
          </button>
        }
      />

      {/* Right Action Control Buttons */}
      <div className="flex items-center gap-1.5 md:gap-2 relative shrink-0" ref={menuRef}>
        {/* Toggle Left Sidebar / Modules Button */}
        <button
          type="button"
          onClick={onToggleModules}
          title={isModulesOpen ? "Close Left Sidebar" : "Open Left Sidebar"}
          aria-label="Toggle Modules Panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-default bg-surface-primary text-content-secondary shadow-2xs transition-colors hover:bg-surface-muted hover:text-content-primary lg:hidden"
        >
          <PanelLeftIcon isActive={isModulesOpen} />
        </button>

        {/* Toggle Right Sidebar / Stage Info Button */}
        <button
          type="button"
          onClick={onToggleStageInfo}
          title={isStageInfoOpen ? "Close Right Sidebar" : "Open Right Sidebar"}
          aria-label="Toggle Stage Info Panel"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-default bg-surface-primary text-content-secondary shadow-2xs transition-colors hover:bg-surface-muted hover:text-content-primary lg:hidden"
        >
          <PanelRightIcon isActive={isStageInfoOpen} />
        </button>

        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          title="More options"
          aria-label="More options"
          aria-expanded={isMenuOpen}
          className="w-8 h-8 rounded-lg border border-line-default bg-surface-primary hover:bg-surface-muted text-content-secondary hover:text-content-primary flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
        >
          <DotsVerticalIcon size={15} />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 top-10 w-52 bg-surface-primary border border-line-default rounded-xl shadow-lg p-1.5 z-50">
            <button
              type="button"
              onClick={handleShare}
              className="w-full px-3 py-2 text-xs text-content-primary hover:bg-surface-muted rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer text-left"
            >
              <ShareLinkIcon size={14} className="text-content-secondary" />
              <span>Copy Link</span>
            </button>

            <div className="my-1 border-t border-line-subtle" />

            <button
              type="button"
              onClick={handleReport}
              className="w-full px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2.5 font-medium transition-colors cursor-pointer text-left"
            >
              <FlagIcon size={14} className="text-rose-500" />
              <span>Report Content Issue</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
