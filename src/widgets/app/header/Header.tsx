import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { SEARCH_QUERY_MAX_LENGTH, UI_TEXT } from "@/shared/config";
import { SearchQuerySchema } from "@/shared/schemas";
import { IconButton, SectionBoundary, toast } from "@/shared/ui";
import { BellIcon, MenuIcon, SearchIcon } from "@/shared/ui/icons";
import { NotificationPanel } from "./components/NotificationPanel";
import { UserProfileBadge } from "./components/UserProfileBadge";
import { UserProfileDropdown } from "./components/UserProfileDropdown";

export interface HeaderProps {
  pageTitle?: string;
  userName?: string;
  userStatus?: string;
  userEmail?: string;
  notificationCount?: number;
  onSearch?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  mobileDrawerOpen?: boolean;
  onToggleMobileDrawer?: () => void;
  onProfileClick?: () => void;
  onLogoutClick?: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  pageTitle = UI_TEXT.dashboard,
  userName,
  userStatus,
  userEmail,
  notificationCount,
  onSearch,
  onSearchSubmit,
  mobileDrawerOpen,
  onToggleMobileDrawer,
  onProfileClick,
  onLogoutClick,
  className = "",
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationId = useId();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInvalid, setSearchInvalid] = useState(false);
  const searchErrorId = useId();
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationTriggerRef = useRef<HTMLDivElement>(null);

  const closeNotifications = () => {
    setNotificationsOpen(false);
    notificationTriggerRef.current?.querySelector("button")?.focus({ preventScroll: true });
  };

  const closeProfile = () => {
    setIsDropdownOpen(false);
    profileRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
  };

  useEffect(() => {
    if (!isDropdownOpen && !notificationsOpen) return;
    if (isDropdownOpen)
      profileRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) {
        setIsDropdownOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isDropdownOpen, notificationsOpen]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = SearchQuerySchema.safeParse(searchQuery);
    if (!result.success) {
      setSearchInvalid(true);
      toast.error(UI_TEXT.searchTooLong);
      return;
    }
    if (result.data) onSearchSubmit?.(result.data);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInvalid(false);
    setSearchQuery(e.target.value);
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  const displayName = userName?.trim() || UI_TEXT.learner;

  return (
    <header
      className={`w-full bg-white border-b border-line-subtle px-3 sm:px-4 lg:px-6 py-2 lg:py-0 lg:h-14 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 lg:gap-3 font-sans select-none shrink-0 ${className}`}
    >
      {/* Top Row on Mobile / Left & Center on Desktop */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 flex-1 min-w-0">
        {/* Mobile Hamburger & Page Brand */}
        <div className="flex items-center gap-2 shrink-0 lg:hidden">
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            aria-label={UI_TEXT.toggleNavigationMenu}
            aria-expanded={mobileDrawerOpen}
            aria-haspopup="dialog"
            className="w-9 h-9 rounded-xl border border-line-default bg-surface-primary hover:bg-surface-muted flex items-center justify-center text-content-secondary transition-colors shrink-0"
          >
            <MenuIcon size={20} />
          </button>
          <span className="font-bold text-base text-content-primary capitalize">{pageTitle}</span>
        </div>

        {/* Desktop Search Bar */}
        <search
          aria-label={UI_TEXT.searchLearningContent}
          className="hidden lg:flex flex-1 justify-center max-w-xl mx-auto"
        >
          <form onSubmit={handleSearchSubmit} className="w-full">
            <div className="relative flex items-center w-full bg-white/80 rounded-full px-4 py-2 border border-line-default shadow-2xs focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-600 transition-all">
              <div className="pointer-events-none text-content-secondary mr-2 shrink-0">
                <SearchIcon size={16} />
              </div>
              <input
                type="text"
                aria-label={UI_TEXT.searchCoursesSkillsTopics}
                value={searchQuery}
                maxLength={SEARCH_QUERY_MAX_LENGTH}
                aria-invalid={searchInvalid || undefined}
                aria-describedby={searchInvalid ? searchErrorId : undefined}
                placeholder={UI_TEXT.searchPlaceholder}
                onChange={handleSearchChange}
                className="w-full bg-transparent text-content-primary placeholder:text-content-secondary font-medium text-sm outline-none border-none"
              />
            </div>
          </form>
        </search>

        {/* Right User Actions (Notifications & Avatar) */}
        <div
          ref={profileRef}
          onBlurCapture={(event) => {
            if (
              event.relatedTarget instanceof Node &&
              !event.currentTarget.contains(event.relatedTarget)
            ) {
              setIsDropdownOpen(false);
              setNotificationsOpen(false);
            }
          }}
          className="relative flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0 min-w-0"
        >
          <div ref={notificationTriggerRef}>
            <IconButton
              aria-label={UI_TEXT.notifications}
              variant="soft-blue"
              size="sm"
              badgeCount={notificationCount}
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              aria-controls={notificationsOpen ? notificationId : undefined}
              onClick={() => {
                setIsDropdownOpen(false);
                setNotificationsOpen((open) => !open);
              }}
              icon={<BellIcon size={18} className="text-content-secondary" />}
            />
          </div>
          {notificationsOpen && (
            <SectionBoundary label={UI_TEXT.notifications}>
              <NotificationPanel id={notificationId} onClose={closeNotifications} />
            </SectionBoundary>
          )}
          <UserProfileBadge
            name={displayName}
            status={userStatus}
            isOpen={isDropdownOpen}
            onClick={() => {
              setNotificationsOpen(false);
              setIsDropdownOpen((prev) => !prev);
            }}
          />
          {userEmail && (
            <UserProfileDropdown
              email={userEmail}
              isOpen={isDropdownOpen}
              onClose={closeProfile}
              onProfileClick={onProfileClick}
              onLogoutClick={onLogoutClick}
            />
          )}
        </div>
      </div>

      {searchInvalid && (
        <p id={searchErrorId} role="alert" className="text-xs text-danger-700">
          {UI_TEXT.searchTooLong}
        </p>
      )}
      {/* Row 2 on Mobile: Full-Width Search Input */}
      <search aria-label={UI_TEXT.searchLearningContent} className="flex lg:hidden w-full pt-0.5">
        <form onSubmit={handleSearchSubmit} className="w-full">
          <div className="relative flex items-center w-full bg-surface-secondary rounded-full px-3.5 py-2 border border-line-default focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-600 transition-all shadow-2xs">
            <div className="pointer-events-none text-content-secondary mr-2 shrink-0">
              <SearchIcon size={16} />
            </div>
            <input
              type="text"
              aria-label={UI_TEXT.searchCoursesSkillsTopics}
              value={searchQuery}
              maxLength={SEARCH_QUERY_MAX_LENGTH}
              aria-invalid={searchInvalid || undefined}
              aria-describedby={searchInvalid ? searchErrorId : undefined}
              placeholder={UI_TEXT.searchPlaceholder}
              onChange={handleSearchChange}
              className="w-full bg-transparent text-content-primary placeholder:text-content-secondary font-medium text-sm outline-none border-none"
            />
          </div>
        </form>
      </search>
    </header>
  );
};
