import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/app/store";
import { IconButton } from "@/shared/ui";
import { UserProfileBadge } from "./components/UserProfileBadge";
import { UserProfileDropdown } from "./components/UserProfileDropdown";

export interface HeaderProps {
  userName?: string;
  userStatus?: string;
  userEmail?: string;
  notificationCount?: number;
  onSearch?: (query: string) => void;
  onProfileClick?: () => void;
  onLogoutClick?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  userStatus,
  userEmail,
  notificationCount,
  onSearch,
  onProfileClick,
  onLogoutClick,
  className = "",
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const storeUserEmail = useAuthStore((state) => state.user?.email);
  const storeLogout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  const displayName = userName?.trim() || "Learner";
  const displayEmail = userEmail || storeUserEmail || "alex.johnson@example.com";

  const handleProfile = () => {
    if (onProfileClick) {
      onProfileClick();
    } else {
      navigate("/dashboard");
    }
  };

  const handleLogout = async () => {
    if (onLogoutClick) {
      onLogoutClick();
    } else {
      await storeLogout();
      navigate("/login");
    }
  };

  return (
    <header
      className={`w-full h-16 bg-white border-b border-line-subtle px-6 flex items-center justify-between gap-4 font-sans select-none ${className}`}
    >
      {/* Center Section: High Contrast Centered Pill Search Bar */}
      <div className="flex-1 flex justify-center max-w-xl mx-auto">
        <div className="relative flex items-center w-full bg-white/80 rounded-full px-4 py-2.5 border border-line-default shadow-2xs hover:border-line-default focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-600 transition-all">
          <div className="pointer-events-none text-content-secondary mr-2.5 shrink-0">
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
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full bg-transparent text-content-primary placeholder:text-content-secondary font-medium text-sm outline-none border-none"
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
              className="w-5 h-5 text-content-secondary"
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

        {/* User Profile Container with Dropdown */}
        <div ref={containerRef} className="relative">
          <UserProfileBadge
            name={displayName}
            status={userStatus}
            isOpen={isDropdownOpen}
            onClick={() => setIsDropdownOpen((p) => !p)}
          />
          <UserProfileDropdown
            email={displayEmail}
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            onProfileClick={handleProfile}
            onLogoutClick={handleLogout}
          />
        </div>
      </div>
    </header>
  );
};
