import type React from "react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  /**
   * The text label displayed for this breadcrumb step.
   */
  label: string;
  /**
   * Optional route target for navigation. If omitted, rendered as active/current item.
   */
  href?: string;
  /**
   * Optional click handler for action-based breadcrumbs.
   */
  onClick?: () => void;
  /**
   * Optional icon to render alongside the label.
   */
  icon?: React.ReactNode;
  /**
   * Hide item on small screen sizes (below `md`). Useful for long paths on mobile.
   */
  hideOnMobile?: boolean;
}

export interface BreadcrumbProps {
  /**
   * Ordered list of breadcrumb items from root to current page.
   */
  items: BreadcrumbItem[];
  /**
   * Custom separator node (defaults to '/').
   */
  separator?: React.ReactNode;
  /**
   * Optional leading icon or back button component.
   */
  leadingIcon?: React.ReactNode;
  /**
   * Additional root container CSS classes.
   */
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = "/",
  leadingIcon,
  className = "",
}) => {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 md:gap-2 text-xs min-w-0 font-sans select-none ${className}`}
    >
      {leadingIcon && <div className="inline-flex items-center shrink-0">{leadingIcon}</div>}

      <ol className="flex items-center gap-1.5 md:gap-2 min-w-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const mobileVisibility = item.hideOnMobile ? "hidden md:inline-flex" : "inline-flex";

          return (
            <li
              key={`${item.label}-${index}`}
              className={`items-center gap-1.5 md:gap-2 min-w-0 ${mobileVisibility}`}
            >
              {/* Item Content */}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  onClick={item.onClick}
                  className="inline-flex items-center gap-1 font-semibold text-content-secondary hover:text-content-primary transition-colors shrink-0 no-underline"
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : item.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="inline-flex items-center gap-1 font-semibold text-content-secondary hover:text-content-primary transition-colors cursor-pointer shrink-0 bg-transparent border-none p-0"
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </button>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 font-semibold truncate ${
                    isLast ? "text-brand-600" : "text-content-primary"
                  }`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </span>
              )}

              {/* Separator */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`text-content-muted font-normal select-none shrink-0 ${
                    items[index + 1]?.hideOnMobile ? "hidden md:inline" : "inline"
                  }`}
                >
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
