import type React from "react";
import { ArrowRightIcon, InfoCircleIcon } from "@/shared/ui/icons";

export interface WidgetCardProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  infoTooltip?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  icon,
  title,
  subtitle,
  infoTooltip,
  action,
  headerRight,
  children,
  footer,
  className = "",
}) => {
  return (
    <div
      className={`bg-surface-primary rounded-2xl border border-line-default p-6 shadow-xs flex flex-col justify-between h-full ${className}`}
    >
      <div className="flex-1 flex flex-col">
        {/* Header Block */}
        <div className="mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon && (
                <span className="text-content-primary shrink-0 flex items-center">{icon}</span>
              )}
              <h2 className="text-base sm:text-lg font-bold text-content-primary">{title}</h2>
              {infoTooltip && (
                <button
                  type="button"
                  aria-label={infoTooltip}
                  className="text-content-secondary hover:text-content-primary transition-colors cursor-pointer"
                >
                  <InfoCircleIcon
                    size={16}
                    className="text-content-secondary hover:text-content-primary transition-colors"
                  />
                </button>
              )}
            </div>

            {headerRight ||
              (action && (
                <a
                  href={action.href || "#"}
                  onClick={action.onClick}
                  className="text-xs sm:text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1"
                >
                  <span>{action.label}</span>
                  <ArrowRightIcon size={14} />
                </a>
              ))}
          </div>

          {subtitle && (
            <p className="text-xs text-content-secondary font-medium mt-1">{subtitle}</p>
          )}
        </div>

        {/* Children Container */}
        <div className="flex-1 flex flex-col">{children}</div>
        {footer && (
          <div className="pt-4 mt-auto text-[11px] text-content-secondary font-medium">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
