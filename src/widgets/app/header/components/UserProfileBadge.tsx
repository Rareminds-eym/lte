import type React from "react";
import { Image } from "@/shared/ui";
import { ChevronRightIcon, UserIcon } from "@/shared/ui/icons";

export interface UserProfileBadgeProps {
  name: string;
  status?: string;
  avatarUrl?: string;
  isOpen?: boolean;
  onClick?: () => void;
  className?: string;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({
  name,
  status,
  avatarUrl,
  isOpen = false,
  onClick,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      className={`flex items-center gap-2 p-1 rounded-xl hover:bg-surface-muted transition-colors cursor-pointer text-left border-none bg-transparent ${className}`}
    >
      {/* Avatar Circle */}
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          className="w-8 h-8 rounded-full object-cover shrink-0 shadow-xs"
          loading="eager"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shrink-0 shadow-xs text-white">
          <UserIcon size={16} />
        </div>
      )}

      {/* User Details */}
      <div className="hidden sm:flex flex-col leading-tight max-w-[120px]">
        <span className="text-sm font-bold text-content-primary truncate">{name}</span>
        {status && (
          <span className="text-xs font-normal text-content-muted truncate">{status}</span>
        )}
      </div>

      {/* Dropdown Chevron */}
      <ChevronRightIcon
        size={14}
        className={`text-content-secondary ml-0.5 transition-transform duration-200 ${
          isOpen ? "-rotate-90" : "rotate-90"
        }`}
      />
    </button>
  );
};
