import type React from "react";

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
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
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
                  <svg
                    aria-hidden="true"
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
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
