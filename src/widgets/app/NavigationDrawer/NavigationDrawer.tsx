import type React from "react";
import { useState } from "react";
import { Button, IconButton, Image, LockIcon, toast } from "@/shared/ui";

const SvgIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    aria-hidden="true"
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

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

const COMING_SOON_TOAST: React.ReactNode = (
  <LockIcon size={16} className="text-content-secondary" />
);

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  activeNavId: initialActiveNavId = "dashboard",
  isCollapsed = false,
  onToggleCollapse,
  onNavigate,
  className = "",
}) => {
  const [activeId, setActiveId] = useState(initialActiveNavId);

  const handleToggle = () => onToggleCollapse?.();

  const handleNavClick = (id: string) => {
    const item = navItems.find((i) => i.id === id);
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

  const navItems: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
        <SvgIcon>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </SvgIcon>
      ),
    },
    {
      id: "my-courses",
      label: "My Courses",
      icon: (
        <SvgIcon>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </SvgIcon>
      ),
    },
    {
      id: "rewards-milestones",
      label: "Rewards & Milestones",
      locked: true,
      icon: (
        <SvgIcon>
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </SvgIcon>
      ),
    },
    {
      id: "career-explorer",
      label: "Career Explorer",
      locked: true,
      icon: (
        <SvgIcon>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </SvgIcon>
      ),
    },
    {
      id: "learning-progress",
      label: "Learning Progress",
      locked: true,
      icon: (
        <SvgIcon>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="m9 14 2 2 4-4" />
        </SvgIcon>
      ),
    },
    {
      id: "mentor-feedback",
      label: "Mentor Feedback",
      locked: true,
      icon: (
        <SvgIcon>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </SvgIcon>
      ),
    },
    {
      id: "achievements",
      label: "Achievements",
      locked: true,
      icon: (
        <SvgIcon>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 1 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7.5" />
          <path d="M14 14.66V17c0 .55.45 1 1 1h1.5" />
          <path d="M18 4H6v7a6 6 0 0 0 12 0V4z" />
        </SvgIcon>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      locked: true,
      icon: (
        <SvgIcon>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </SvgIcon>
      ),
    },
  ];

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
        <svg
          aria-hidden="true"
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isCollapsed ? (
            <polyline points="9 18 15 12 9 6" />
          ) : (
            <polyline points="15 18 9 12 15 6" />
          )}
        </svg>
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
          {navItems.map((item) => {
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
              icon={
                <svg aria-hidden="true" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                </svg>
              }
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
              icon={
                <svg aria-hidden="true" className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                </svg>
              }
            >
              Ask AI Mentor
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};
