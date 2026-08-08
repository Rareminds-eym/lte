import type React from "react";
import { cn } from "@/shared/lib";

interface InlineSpinnerProps {
  /** Size in Tailwind h/w units. Defaults to 4 (1rem). */
  size?: "3" | "4" | "5" | "6";
  /** Additional classes */
  className?: string;
  /** Screen-reader label */
  "aria-label"?: string;
}

const sizeMap: Record<NonNullable<InlineSpinnerProps["size"]>, string> = {
  "3": "h-3 w-3 border-2",
  "4": "h-4 w-4 border-2",
  "5": "h-5 w-5 border-2",
  "6": "h-6 w-6 border-[3px]",
};

/**
 * Lightweight inline spinner for action feedback.
 *
 * Use for:
 *  - Button loading states
 *  - Small list / card refresh indicators
 *  - Inline sub-component status
 *
 * Do NOT use as a page-level or layout-level loader.
 */
export const InlineSpinner: React.FC<InlineSpinnerProps> = ({
  size = "4",
  className,
  "aria-label": ariaLabel = "Loading…",
}) => (
  <span
    role="status"
    aria-label={ariaLabel}
    className={cn("inline-flex items-center justify-center", className)}
  >
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-surface-muted border-t-brand-600",
        sizeMap[size],
      )}
    />
    <span className="sr-only">{ariaLabel}</span>
  </span>
);
