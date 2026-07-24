import type React from "react";

export interface UserProfileBadgeProps {
  name: string;
  status?: string;
  avatarUrl?: string;
  onClick?: () => void;
  className?: string;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({
  name,
  status,
  avatarUrl,
  onClick,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 p-1 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer text-left border-none bg-transparent ${className}`}
    >
      {/* Avatar Circle */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-9 h-9 rounded-full object-cover shrink-0 shadow-xs"
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
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-slate-900">{name}</span>
        {status && <span className="text-xs font-normal text-slate-400">{status}</span>}
      </div>

      {/* Dropdown Chevron */}
      <svg
        aria-hidden="true"
        className="w-3.5 h-3.5 text-slate-600 ml-0.5"
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
