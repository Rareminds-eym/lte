import type React from "react";
import { cn } from "@/shared/lib";

interface SkeletonProps {
  /** Additional class names for sizing, rounding, etc. */
  className?: string;
}

/**
 * Generic structural skeleton element (individual box/line).
 * By default, these are decorative placeholders to prevent screen reader noise.
 * Always wrap them in a SkeletonGroup to handle screen reader announcements.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={cn("bg-surface-muted rounded", className)} aria-hidden="true" />
);

interface SkeletonGroupProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Visually hidden text announced by screen readers.
   * If provided, the group is marked as role="status" / aria-live="polite".
   */
  "aria-label"?: string;
}

/**
 * Container that manages pulse animations and accessibility for loading states.
 * If `aria-label` is supplied, it acts as a single loading status block for screen readers.
 */
export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  children,
  className,
  "aria-label": ariaLabel,
}) => {
  const isAccessibleStatus = !!ariaLabel;

  return (
    <div
      className={cn("animate-pulse", className)}
      role={isAccessibleStatus ? "status" : undefined}
      aria-live={isAccessibleStatus ? "polite" : undefined}
      aria-busy={isAccessibleStatus ? "true" : undefined}
    >
      {isAccessibleStatus && <span className="sr-only">{ariaLabel}</span>}
      {children}
    </div>
  );
};
