import type React from "react";
import { useState } from "react";
import { IconButton } from "@/shared/ui";
import { BellIcon, MenuIcon, SearchIcon } from "@/shared/ui/icons";
import { UserProfileBadge } from "./components/UserProfileBadge";
import { UserProfileDropdown } from "./components/UserProfileDropdown";

export interface HeaderProps {
  pageTitle?: string;
  userName?: string;
  userStatus?: string;
  userEmail?: string;
  notificationCount?: number;
  onSearch?: (query: string) => void;
  onToggleMobileDrawer?: () => void;
  onProfileClick?: () => void;
  onLogoutClick?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle = "Dashboard",
  userName,
  userStatus,
  userEmail,
  notificationCount,
  onSearch,
  onToggleMobileDrawer,
  onProfileClick,
  onLogoutClick,
  className = "",
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  const displayName = userName?.trim() || "Learner";

  return (
    <header
      className={`w-full bg-white border-b border-line-subtle px-3 sm:px-4 md:px-6 py-2.5 md:py-0 md:h-16 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 md:gap-4 font-sans select-none shrink-0 ${className}`}
    >
      {/* Top Row on Mobile / Left & Center on Desktop */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 flex-1 min-w-0">
        {/* Mobile Hamburger & Page Brand */}
        <div className="flex items-center gap-2 shrink-0 md:hidden">
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            aria-label="Toggle navigation menu"
            className="w-9 h-9 rounded-xl border border-line-default bg-surface-primary hover:bg-surface-muted flex items-center justify-center text-content-secondary transition-colors shrink-0"
          >
            <MenuIcon size={20} />
          </button>
          <span className="font-bold text-base text-content-primary capitalize">{pageTitle}</span>
        </div>

        {/* Desktop Search Bar */}
        <div className="hidden md:flex flex-1 justify-center max-w-xl mx-auto">
          <div className="relative flex items-center w-full bg-white/80 rounded-full px-4 py-2.5 border border-line-default shadow-2xs focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-600 transition-all">
            <div className="pointer-events-none text-content-secondary mr-2.5 shrink-0">
              <SearchIcon size={16} />
            </div>
            <input
              type="text"
              placeholder="Search courses, skills, topics..."
              onChange={handleSearchChange}
              className="w-full bg-transparent text-content-primary placeholder:text-content-secondary font-medium text-sm outline-none border-none"
            />
          </div>
        </div>

        {/* Right User Actions (Notifications & Avatar) */}
        <div className="relative flex items-center gap-1.5 sm:gap-2.5 md:gap-4 shrink-0 min-w-0">
          <IconButton
            aria-label="Notifications"
            variant="soft-blue"
            size="md"
            badgeCount={notificationCount}
            icon={<BellIcon size={20} className="text-content-secondary" />}
          />
          <UserProfileBadge
            name={displayName}
            status={userStatus}
            isOpen={isDropdownOpen}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
          />
          {userEmail && (
            <UserProfileDropdown
              email={userEmail}
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
              onProfileClick={onProfileClick}
              onLogoutClick={onLogoutClick}
            />
          )}
        </div>
      </div>

      {/* Row 2 on Mobile: Full-Width Search Input */}
      <div className="flex md:hidden w-full pt-1 pb-0.5">
        <div className="relative flex items-center w-full bg-surface-secondary rounded-full px-3.5 py-2.5 border border-line-default focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-600 transition-all shadow-2xs">
          <div className="pointer-events-none text-content-secondary mr-2.5 shrink-0">
            <SearchIcon size={16} />
          </div>
          <input
            type="text"
            placeholder="Search courses, skills, topics..."
            onChange={handleSearchChange}
            className="w-full bg-transparent text-content-primary placeholder:text-content-secondary font-medium text-sm outline-none border-none"
          />
        </div>
      </div>
    </header>
  );
};
