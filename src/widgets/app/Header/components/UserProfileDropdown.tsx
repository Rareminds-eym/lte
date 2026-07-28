import type React from "react";

export interface UserProfileDropdownProps {
  email: string;
  isOpen: boolean;
  onClose: () => void;
  onProfileClick?: () => void;
  onLogoutClick?: () => void;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  email,
  isOpen,
  onClose,
  onProfileClick,
  onLogoutClick,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="menu"
      aria-orientation="vertical"
      className="absolute right-0 top-full mt-2 w-64 bg-surface-primary rounded-2xl border border-line-default shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 select-none"
    >
      {/* Row 1: Email Header */}
      <div className="px-4 py-3 text-center border-b border-line-subtle">
        <span className="text-xs font-semibold text-content-primary break-all">{email}</span>
      </div>

      {/* Row 2: Your Profile */}
      <div className="p-1 border-b border-line-subtle">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onProfileClick?.();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-content-body hover:text-content-primary hover:bg-surface-muted rounded-xl transition-colors cursor-pointer border-none bg-transparent"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4 text-content-secondary shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Your Profile</span>
        </button>
      </div>

      {/* Row 3: Logout */}
      <div className="p-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onLogoutClick?.();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border-none bg-transparent"
        >
          <svg
            aria-hidden="true"
            className="w-4 h-4 text-red-500 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};
