import type React from "react";
import { LogoutIcon, UserIcon } from "@/shared/ui/icons";

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
          <UserIcon size={16} className="text-content-secondary shrink-0" />
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
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-danger-500 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-colors cursor-pointer border-none bg-transparent"
        >
          <LogoutIcon size={16} className="text-danger-500 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};
