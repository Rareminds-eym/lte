import type React from "react";
import { Fragment } from "react";
import { Button } from "@/shared/ui";

export interface HeaderProps {
  breadcrumbs?: Array<{ label: string; href?: string }>;
  userName?: string;
  userRole?: string;
  userInitials?: string;
  notificationCount?: number;
  onSearch?: (query: string) => void;
  onBackClick?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs = [{ label: "Home" }, { label: "My Courses" }],
  userName = "Alex Johnson",
  userRole = "UI/UX Designer",
  userInitials = "AJ",
  notificationCount = 3,
  onSearch,
  onBackClick,
  className = "",
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  return (
    <header
      className={`w-full h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between gap-4 font-sans select-none ${className}`}
    >
      {/* Left Section: Back Button & Breadcrumbs */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Reusable Icon Button for Back Arrow */}
        <Button
          variant="icon"
          size="sm"
          onClick={onBackClick}
          aria-label="Go back"
          icon={
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-gray-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          }
        />

        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm text-gray-500 font-medium"
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <Fragment key={crumb.label}>
                {idx > 0 && (
                  <svg
                    aria-hidden="true"
                    className="w-3.5 h-3.5 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
                <span className={isLast ? "font-bold text-gray-900" : "hover:text-gray-700"}>
                  {crumb.label}
                </span>
              </Fragment>
            );
          })}
        </nav>
      </div>

      {/* Center Section: Pill Search Bar */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative flex items-center w-full">
          <div className="absolute left-3.5 pointer-events-none text-gray-400">
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
            placeholder="Search courses, topics, instructors"
            onChange={handleSearchChange}
            className="w-full bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-gray-800 placeholder-gray-400 text-xs rounded-full pl-10 pr-4 py-2.5 transition-all outline-none border border-transparent focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Right Section: Notifications & User Profile */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Notification Icon Button with Red Badge */}
        <div className="relative">
          <Button
            variant="icon"
            size="md"
            aria-label="Notifications"
            icon={
              <svg
                aria-hidden="true"
                className="w-5 h-5 text-gray-600"
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
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-white">
              {notificationCount}
            </span>
          )}
        </div>

        {/* User Profile Component */}
        <div className="flex items-center gap-2.5 cursor-pointer pl-1">
          {/* User Initials Avatar Circle */}
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs tracking-wider shrink-0">
            {userInitials}
          </div>

          {/* User Details */}
          <div className="flex flex-col text-left leading-snug">
            <span className="text-xs font-bold text-gray-900">{userName}</span>
            <span className="text-[11px] font-normal text-gray-400">{userRole}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
