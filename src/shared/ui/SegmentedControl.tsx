import type React from "react";
import { cn } from "@/shared/lib";

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  ariaLabel: string;
  className?: string;
}

/**
 * Segmented control for mutually exclusive display options (e.g. Cards vs List).
 * Matches design spec with rounded wrapper, soft active background, and icon styling.
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}) => {
  return (
    <fieldset
      className={cn(
        "inline-flex items-center p-1 border border-line-default rounded-xl bg-surface-primary shadow-2xs gap-0.5 m-0",
        className,
      )}
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 focus-visible:z-10",
              isSelected
                ? "bg-brand-50 text-brand-600 font-medium"
                : "bg-transparent text-content-muted hover:text-content-secondary hover:bg-surface-subtle",
            )}
          >
            {option.icon}
          </button>
        );
      })}
    </fieldset>
  );
};
