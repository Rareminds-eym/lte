import type React from "react";
import { useState } from "react";
import { Button, IconButton } from "@/shared/ui";

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
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  activeNavId: initialActiveNavId = "dashboard",
  isCollapsed: isCollapsedProp,
  onToggleCollapse,
  onNavigate,
  className = "",
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [activeId, setActiveId] = useState(initialActiveNavId);

  const isCollapsed = isCollapsedProp ?? internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const handleNavClick = (id: string) => {
    setActiveId(id);
    if (onNavigate) {
      onNavigate(id);
    }
  };

  const navItems: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
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
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: "my-courses",
      label: "My Courses",
      icon: (
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
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
    },
    {
      id: "rewards-milestones",
      label: "Rewards & Milestones",
      icon: (
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
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
    {
      id: "career-explorer",
      label: "Career Explorer",
      icon: (
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
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
    },
    {
      id: "learning-progress",
      label: "Learning Progress",
      icon: (
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
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      ),
    },
    {
      id: "mentor-feedback",
      label: "Mentor Feedback",
      icon: (
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "achievements",
      label: "Achievements",
      icon: (
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
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 1 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7.5" />
          <path d="M14 14.66V17c0 .55.45 1 1 1h1.5" />
          <path d="M18 4H6v7a6 6 0 0 0 12 0V4z" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`relative bg-white border-r border-slate-100 h-screen flex flex-col justify-between p-3.5 shrink-0 font-sans select-none transition-[width] duration-300 ease-in-out ${
        isCollapsed ? "w-[72px]" : "w-64"
      } ${className}`}
    >
      {/* Floating Collapse / Expand Toggle Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 shadow-md flex items-center justify-center -right-4 top-[2.875rem] absolute z-20 cursor-pointer hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95"
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
              <img
                src="/assets/images/rm-bulb.webp"
                alt="RareMinds"
                className="w-11 h-11 object-contain shrink-0 transition-transform duration-200 hover:scale-105"
              />
            </div>
          ) : (
            <img
              src="/assets/images/rareminds.webp"
              alt="RareMinds - Applied Learning. Transforming Work"
              className="h-14 max-w-[210px] w-auto object-contain shrink-0 transition-opacity duration-200"
            />
          )}
        </div>

        {/* Unified Navigation Menu */}
        <nav className="space-y-1 w-full flex flex-col">
          {navItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={isCollapsed ? item.label : undefined}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl font-semibold text-sm transition-colors duration-150 cursor-pointer overflow-hidden ${
                  isActive
                    ? "bg-[#eff6ff] text-[#2563eb]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span
                  className={`shrink-0 flex items-center justify-center w-5 h-5 ${
                    isActive ? "text-[#2563eb]" : "text-slate-600"
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
              aria-label="Ask AI Mentor"
              icon={
                <svg aria-hidden="true" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                </svg>
              }
            />
          </div>
        ) : (
          /* Expanded AI Mentor Promo Card */
          <div className="bg-[#f8fafc] border border-slate-100/80 rounded-2xl p-4 flex flex-col space-y-2.5 text-left transition-all duration-300">
            <h3 className="text-xs font-bold text-slate-800 leading-snug">
              Need help choosing what to do next?
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-tight">
              Get guidance from your AI Mentor
            </p>
            <Button
              variant="primary"
              size="sm"
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-sm py-2.5 px-4 rounded-xl shadow-xs border-none justify-center mt-1"
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
