import type React from "react";
import { useId, useState } from "react";
import { UI_TEXT } from "@/shared/config";
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
  scrollable?: boolean;
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
  scrollable = false,
}) => {
  const tooltipId = useId();
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const actionStyles =
    "text-xs sm:text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer";
  return (
    <section
      aria-label={title}
      className={`@container/widget bg-surface-primary rounded-2xl border border-line-default p-6 shadow-xs flex flex-col min-w-0 ${scrollable ? "overflow-hidden" : ""} ${className}`}
    >
      {/* Header Block */}
      <header className="mb-5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <span className="text-content-primary shrink-0 flex items-center">{icon}</span>
            )}
            <h2 className="min-w-0 break-words text-base sm:text-lg font-bold text-content-primary">
              {title}
            </h2>
            {infoTooltip && (
              <span className="group/tooltip relative shrink-0 inline-flex">
                <button
                  type="button"
                  aria-label={UI_TEXT.about(title)}
                  aria-describedby={tooltipId}
                  onFocus={() => setTooltipDismissed(false)}
                  onPointerEnter={() => setTooltipDismissed(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setTooltipDismissed(true);
                  }}
                  className="text-content-secondary hover:text-content-primary transition-colors cursor-help"
                >
                  <InfoCircleIcon
                    size={16}
                    className="text-content-secondary hover:text-content-primary transition-colors"
                  />
                </button>
                <span
                  id={tooltipId}
                  role="tooltip"
                  className={`absolute right-0 top-full z-20 w-48 rounded-lg bg-surface-hero p-3 text-xs font-normal text-content-inverse shadow-lg invisible opacity-0 ${tooltipDismissed ? "" : "group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100"}`}
                >
                  {infoTooltip}
                </span>
              </span>
            )}
          </div>

          {headerRight ||
            (action &&
              (action.onClick ? (
                <button type="button" onClick={action.onClick} className={actionStyles}>
                  <span>{action.label}</span>
                  <ArrowRightIcon size={14} />
                </button>
              ) : (
                <a href={action.href || "#"} className={actionStyles}>
                  <span>{action.label}</span>
                  <ArrowRightIcon size={14} />
                </a>
              )))}
        </div>

        {subtitle && <p className="text-xs text-content-secondary font-medium mt-1">{subtitle}</p>}
      </header>

      <section
        aria-label={scrollable ? UI_TEXT.cardContent(title) : undefined}
        tabIndex={scrollable ? 0 : undefined}
        className={`min-h-0 flex-auto ${scrollable ? "overflow-x-hidden overflow-y-auto" : ""}`}
      >
        <div className="flex flex-col">{children}</div>
        {footer && (
          <div className="pt-4 text-[11px] text-content-secondary font-medium">{footer}</div>
        )}
      </section>
    </section>
  );
};
