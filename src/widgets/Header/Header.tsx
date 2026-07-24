import type React from "react";
import { IconButton } from "@/shared/ui";
import { UserProfileBadge } from "./components/UserProfileBadge";

export interface HeaderProps {
  userName?: string;
  userStatus?: string;
  notificationCount?: number;
  onSearch?: (query: string) => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  userStatus,
  notificationCount,
  onSearch,
  className = "",
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  const displayName = userName?.trim() || "Learner";

  return (
    <header
      className={`w-full h-16 bg-white border-b border-slate-100 px-6 flex items-center justify-between gap-4 font-sans select-none ${className}`}
    >
      {/* Center Section: High Contrast Centered Pill Search Bar */}
      <div className="flex-1 flex justify-center max-w-xl mx-auto">
        <div className="relative flex items-center w-full bg-slate-100/90 rounded-full px-4 py-2.5 border border-slate-300 shadow-2xs hover:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
          <div className="pointer-events-none text-slate-500 mr-2.5 shrink-0">
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search courses, skills, topics..."
            onChange={handleSearchChange}
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-500 font-medium text-sm outline-none border-none"
          />
        </div>
      </div>

      {/* Right Section: Notifications & User Profile */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Notification Bell Icon Component */}
        <IconButton
          aria-label="Notifications"
          variant="soft-blue"
          size="md"
          badgeCount={notificationCount}
          icon={
            <svg
              aria-hidden="true"
              className="w-5 h-5 text-slate-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          }
        />

        {/* User Profile Component */}
        <UserProfileBadge name={displayName} status={userStatus} />
      </div>
    </header>
  );
};
