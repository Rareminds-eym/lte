import type React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  badgeCount?: number;
  variant?: "soft-blue" | "outline" | "solid-blue";
  size?: "sm" | "md" | "lg";
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  badgeCount,
  variant = "soft-blue",
  size = "md",
  className = "",
  type = "button",
  ...props
}) => {
  const sizeClasses = {
    sm: "w-8 h-8 rounded-xl",
    md: "w-10 h-10 rounded-2xl",
    lg: "w-11 h-11 rounded-2xl",
  }[size];

  const variantClasses = {
    "soft-blue":
      "border border-brand-200/70 bg-surface-primary hover:bg-surface-muted text-content-secondary shadow-2xs active:scale-95",
    outline:
      "border border-line-default bg-surface-primary hover:bg-surface-muted text-content-secondary shadow-2xs active:scale-95",
    "solid-blue":
      "bg-brand-600 hover:bg-brand-700 text-white border-none shadow-xs active:scale-95",
  }[variant];

  return (
    <div className="relative inline-flex items-center">
      <button
        type={type}
        className={`${sizeClasses} ${variantClasses} flex items-center justify-center cursor-pointer transition-all duration-150 ${className}`}
        {...props}
      >
        {icon}
      </button>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white pointer-events-none z-10">
          {badgeCount}
        </span>
      )}
    </div>
  );
};
