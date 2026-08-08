import type React from "react";
import { useEffect, useState } from "react";
import {
  BookOpenIcon,
  Button,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  CompassIcon,
  CreditCardIcon,
  DashboardGridIcon,
  IconButton,
  Image,
  LockIcon,
  MessageSquareIcon,
  SettingsIcon,
  SparklesIcon,
  TrophyIcon,
  toast,
} from "@/shared/ui";

const COMING_SOON_TOAST = "⏳";

export interface NavigationDrawerProps {
  activeNavId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: (id: string) => void;
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  locked?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <DashboardGridIcon size={20} />,
  },
  {
    id: "my-courses",
    label: "My Courses",
    icon: <BookOpenIcon size={20} />,
  },
  {
    id: "rewards-milestones",
    label: "Rewards & Milestones",
    locked: true,
    icon: <CreditCardIcon size={20} />,
  },
  {
    id: "career-explorer",
    label: "Career Explorer",
    locked: true,
    icon: <CompassIcon size={20} />,
  },
  {
    id: "learning-progress",
    label: "Learning Progress",
    locked: true,
    icon: <ClipboardCheckIcon size={20} />,
  },
  {
    id: "mentor-feedback",
    label: "Mentor Feedback",
    locked: true,
    icon: <MessageSquareIcon size={20} />,
  },
  {
    id: "achievements",
    label: "Achievements",
    locked: true,
    icon: <TrophyIcon size={20} />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SettingsIcon size={20} />,
  },
];

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  activeNavId: initialActiveNavId = "dashboard",
  isCollapsed = false,
  onToggleCollapse,
  onNavigate,
  className = "",
}) => {
  const [activeId, setActiveId] = useState(initialActiveNavId);

  useEffect(() => {
    setActiveId(initialActiveNavId);
  }, [initialActiveNavId]);

  const handleToggle = () => onToggleCollapse?.();

  const handleNavClick = (id: string) => {
    const item = NAV_ITEMS.find((i) => i.id === id);
    if (item?.locked) {
      toast(`${item.label} is coming soon`, { icon: COMING_SOON_TOAST, id: "coming-soon" });
      return;
    }
    setActiveId(id);
    if (onNavigate) {
      onNavigate(id);
    }
  };

  const handleMentorClick = () => {
    toast("AI Mentor is coming soon", { icon: COMING_SOON_TOAST, id: "coming-soon" });
  };

  return (
    <aside
      className={`relative bg-white border-r border-line-subtle h-screen flex flex-col justify-between p-3.5 shrink-0 font-sans select-none transition-[width] duration-300 ease-in-out ${
        isCollapsed ? "w-[72px]" : "w-64"
      } ${className}`}
    >
      {/* Floating Collapse / Expand Toggle Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden md:flex w-8 h-8 rounded-full bg-white border border-line-default text-content-secondary shadow-md items-center justify-center -right-4 top-[2.875rem] absolute z-20 cursor-pointer hover:bg-surface-muted hover:text-content-primary transition-all active:scale-95"
      >
        {isCollapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
      </button>

      {/* Top Header & Navigation */}
      <div className="space-y-6 w-full flex flex-col flex-1 min-h-0 overflow-y-auto">
        {/* Brand Logo Section */}
        <div className="pt-1 pb-2 px-1 w-full flex items-center h-16 overflow-hidden">
          {isCollapsed ? (
            <div className="w-full flex justify-center items-center">
              <Image
                src="/assets/images/rm-bulb.webp"
                alt="RareMinds"
                priority
                className="w-11 h-11 object-contain shrink-0 transition-transform duration-200 hover:scale-105"
              />
            </div>
          ) : (
            <Image
              src="/assets/images/rareminds.webp"
              alt="RareMinds - Applied Learning. Transforming Work"
              priority
              className="h-14 max-w-[210px] w-auto object-contain shrink-0 transition-opacity duration-200"
            />
          )}
        </div>

        {/* Unified Navigation Menu */}
        <nav className="space-y-1 w-full flex flex-col">
          {NAV_ITEMS.map((item) => {
            const isActive = activeId === item.id;
            const isLocked = Boolean(item.locked);
            return (
              <button
                key={item.id}
                type="button"
                aria-disabled={isLocked || undefined}
                aria-label={isLocked ? `${item.label} — Coming soon` : undefined}
                title={
                  isLocked ? `${item.label} — Coming soon` : isCollapsed ? item.label : undefined
                }
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl font-semibold text-sm transition-colors duration-150 overflow-hidden ${
                  isLocked
                    ? "text-content-secondary cursor-not-allowed hover:bg-surface-muted"
                    : isActive
                      ? "bg-brand-50 text-brand-600 cursor-pointer"
                      : "text-content-secondary hover:bg-surface-muted hover:text-content-primary cursor-pointer"
                }`}
              >
                <span
                  className={`shrink-0 flex items-center justify-center w-5 h-5 ${
                    isLocked
                      ? "text-content-secondary"
                      : isActive
                        ? "text-brand-600"
                        : "text-content-secondary"
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${
                    isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
                  }`}
                >
                  {item.label}
                </span>
                {isLocked && (
                  <LockIcon size={14} className="shrink-0 ml-auto text-content-secondary" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom AI Mentor Card Widget */}
      <div className="w-full pt-4 overflow-hidden">
        {isCollapsed ? (
          /* Collapsed AI Mentor Icon Button */
          <div className="flex justify-center w-full">
            <IconButton
              variant="solid-blue"
              size="lg"
              aria-label="Ask AI Mentor — Coming soon"
              aria-disabled="true"
              title="Ask AI Mentor — Coming soon"
              onClick={handleMentorClick}
              icon={<SparklesIcon size={20} />}
            />
          </div>
        ) : (
          /* Expanded AI Mentor Promo Card */
          <div className="bg-surface-secondary rounded-2xl p-4 flex flex-col space-y-2.5 text-left transition-all duration-300">
            <h3 className="text-xs font-bold text-content-primary leading-snug">
              Need help choosing what to do next?
            </h3>
            <p className="text-xs text-content-muted font-medium leading-tight">
              Get guidance from your AI Mentor
            </p>
            <Button
              variant="primary"
              size="sm"
              aria-label="Ask AI Mentor — Coming soon"
              aria-disabled="true"
              title="Ask AI Mentor — Coming soon"
              onClick={handleMentorClick}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-xs border-none justify-center mt-1 cursor-not-allowed!"
              icon={<SparklesIcon size={16} />}
            >
              Ask AI Mentor
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};
