import type React from "react";
import { Image } from "@/shared/ui";

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
      className={`flex items-center gap-2.5 p-1 rounded-2xl hover:bg-surface-muted transition-colors cursor-pointer text-left border-none bg-transparent ${className}`}
    >
      {/* Avatar Circle */}
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          className="w-9 h-9 rounded-full object-cover shrink-0 shadow-xs"
          loading="eager"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center shrink-0 shadow-xs">
          <svg
            aria-hidden="true"
            className="w-4.5 h-4.5 text-white"
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
      <svg
        aria-hidden="true"
        className={`w-3.5 h-3.5 text-content-secondary ml-0.5 transition-transform duration-200 ${
          isOpen ? "rotate-180" : ""
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
};
