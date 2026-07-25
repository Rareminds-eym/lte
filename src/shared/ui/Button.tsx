import type React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "icon";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variants = {
    primary: "bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-xs",
    secondary: "bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg",
    outline: "border border-line-default hover:bg-surface-muted text-content-primary rounded-lg",
    ghost: "text-content-secondary hover:bg-surface-muted rounded-lg",
    icon: "text-content-muted hover:bg-surface-muted rounded-full border border-line-default bg-surface-primary shadow-xs",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  // Special size handling for icon variant if no children provided
  const isIconOnly = variant === "icon" && !children;
  const iconOnlySizes = {
    sm: "w-8 h-8 p-0 text-xs",
    md: "w-9 h-9 p-0 text-sm",
    lg: "w-10 h-10 p-0 text-base",
  };

  const computedSize = isIconOnly ? iconOnlySizes[size] : sizes[size];
  const combinedClassName =
    `${baseStyles} ${variants[variant]} ${computedSize} ${className}`.trim();

  return (
    <button className={combinedClassName} disabled={disabled} {...props}>
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
