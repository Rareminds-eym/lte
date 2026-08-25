import React from "react";

// ─── Single RadioButton Primitive ───────────────────────────────────────────

export interface RadioButtonProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const RadioButton = React.forwardRef<HTMLInputElement, RadioButtonProps>(
  ({ id, label, description, className = "", disabled, checked, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all duration-150 ${
          disabled
            ? "opacity-50 cursor-not-allowed border-line-subtle bg-surface-muted"
            : checked
              ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500/20 cursor-pointer"
              : "border-line-default bg-white hover:border-line-emphasis cursor-pointer"
        } ${className}`}
      >
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            ref={ref}
            id={id}
            type="radio"
            checked={checked}
            disabled={disabled}
            className="sr-only"
            {...props}
          />
          <div
            className={`w-4 h-4 rounded-full border transition-all flex items-center justify-center ${
              checked ? "border-brand-600 bg-brand-600" : "border-line-emphasis bg-white"
            }`}
          >
            {checked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
        </div>
        {(label || description) && (
          <div className="flex-1 min-w-0">
            {label && (
              <span className="block text-sm font-medium text-content-primary leading-tight">
                {label}
              </span>
            )}
            {description && <p className="text-xs text-content-secondary mt-0.5">{description}</p>}
          </div>
        )}
      </label>
    );
  },
);

RadioButton.displayName = "RadioButton";

// ─── RadioGroup Compound Component ──────────────────────────────────────────

export interface RadioOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string = string> {
  name: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  description?: string;
  error?: string;
  direction?: "vertical" | "horizontal";
  className?: string;
  disabled?: boolean;
}

export function RadioGroup<T extends string = string>({
  name,
  options,
  value,
  onChange,
  label,
  description,
  error,
  direction = "vertical",
  className = "",
  disabled = false,
}: RadioGroupProps<T>): React.ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={error ? `${name}-error` : description ? `${name}-description` : undefined}
      className={`space-y-2 ${className}`}
    >
      {label && (
        <div className="mb-1.5">
          <span className="block text-xs font-semibold text-content-primary">{label}</span>
          {description && (
            <p id={`${name}-description`} className="text-xs text-content-secondary mt-0.5">
              {description}
            </p>
          )}
        </div>
      )}
      <div
        className={
          direction === "horizontal"
            ? "flex flex-wrap items-center gap-4"
            : "flex flex-col space-y-2.5"
        }
      >
        {options.map((option) => (
          <RadioButton
            key={option.value}
            id={`${name}-${option.value}`}
            name={name}
            value={option.value}
            checked={option.value === value}
            disabled={disabled || option.disabled}
            onChange={() => !(disabled || option.disabled) && onChange(option.value)}
            label={option.label}
            description={option.description}
          />
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-xs text-feedback-error font-medium mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
