import type React from "react";
import { useState } from "react";
import { Button } from "@/shared/ui";

export interface NavigationDrawerProps {
  activeNavId?: string;
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
  onNavigate,
  className = "",
}) => {
  const [activeId, setActiveId] = useState(initialActiveNavId);

  const handleNavClick = (id: string) => {
    setActiveId(id);
    if (onNavigate) {
      onNavigate(id);
    }
  };

  const topNavItems: NavItem[] = [
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
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="14" y2="10" />
        </svg>
      ),
    },
    {
      id: "explore",
      label: "Explore",
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
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      ),
    },
    {
      id: "progress",
      label: "Progress",
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
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
    },
  ];

  const bottomNavItems: NavItem[] = [
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
    {
      id: "help-support",
      label: "Help & Support",
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
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col justify-between p-4 shrink-0 font-sans select-none ${className}`}
    >
      {/* Top Header & Navigation */}
      <div className="space-y-6">
        {/* Brand Logo Section */}
        <div className="px-2 pt-2">
          <div className="flex items-center gap-3">
            {/* Brain/Tree Tech Logo */}
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <svg aria-hidden="true" viewBox="0 0 40 40" className="w-10 h-10" fill="none">
                <path
                  d="M20 30V22M20 22L14 16M20 22L26 16M14 16L10 17M14 16L15 11M26 16L30 17M26 16L25 11M20 12V6"
                  stroke="#E11D48"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="10" cy="17" r="2.5" fill="#3B82F6" />
                <circle cx="15" cy="11" r="2.5" fill="#F97316" />
                <circle cx="20" cy="6" r="3" fill="#E11D48" />
                <circle cx="25" cy="11" r="2.5" fill="#F97316" />
                <circle cx="30" cy="17" r="2.5" fill="#3B82F6" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-blue-900 leading-none">
                RAREMINDS
              </h1>
              <p className="text-[9px] font-bold text-red-500 tracking-wider uppercase mt-1 leading-tight">
                APPLYING LEARNING. TRANSFORMING WORK
              </p>
              <p className="text-[8px] text-gray-400 font-medium leading-tight mt-0.5">
                An ISO 9001 & 31001 Certified Company
              </p>
            </div>
          </div>
        </div>

        {/* Primary Navigation Menu */}
        <nav className="space-y-1">
          {topNavItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className={isActive ? "text-blue-600" : "text-gray-400"}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Secondary Navigation & Bottom Card */}
      <div className="space-y-6 pt-6">
        {/* Settings & Help Menu */}
        <nav className="space-y-1 border-t border-gray-100 pt-4">
          {bottomNavItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className={isActive ? "text-blue-600" : "text-gray-400"}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Promo Card Widget */}
        <div className="bg-gradient-to-b from-blue-50/70 to-indigo-50/40 border border-blue-100/60 rounded-2xl p-4 flex flex-col items-center text-center space-y-3">
          {/* Dashboard Illustration Banner */}
          <div className="w-full h-24 relative flex items-center justify-center overflow-hidden rounded-xl bg-white/60">
            <svg aria-hidden="true" viewBox="0 0 160 90" className="w-full h-full" fill="none">
              {/* Analytics Chart SVG Illustration */}
              <rect
                x="10"
                y="15"
                width="80"
                height="55"
                rx="6"
                fill="#F1F5F9"
                stroke="#CBD5E1"
                strokeWidth="1.5"
              />
              <line
                x1="20"
                y1="55"
                x2="80"
                y2="55"
                stroke="#94A3B8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <path
                d="M20 50 L35 38 L50 45 L75 25"
                stroke="#6366F1"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="75" cy="25" r="3" fill="#EC4899" />

              {/* Character Illustration */}
              <circle cx="120" cy="50" r="14" fill="#818CF8" />
              <path d="M106 75 C106 62 134 62 134 75" fill="#4F46E5" />
              <path d="M110 38 L135 20 L130 50" fill="#F43F5E" />
              <polygon points="120,15 125,25 115,25" fill="#F59E0B" />
            </svg>
          </div>

          {/* Reusable Button Component Call */}
          <Button
            variant="primary"
            size="sm"
            className="w-full justify-center rounded-xl font-semibold shadow-xs py-2"
            icon={
              <svg aria-hidden="true" className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            }
          >
            Watch 1 min demo
          </Button>
        </div>
      </div>
    </aside>
  );
};
