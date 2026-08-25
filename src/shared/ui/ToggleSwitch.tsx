import type React from "react";

export interface ToggleSwitchProps {
  id: string;
  checked?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  comingSoon?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked = false,
  onChange,
  label,
  description,
  comingSoon = false,
  disabled = false,
  className = "",
}) => {
  const isDisabled = disabled || comingSoon;

  const handleClick = () => {
    if (isDisabled) {
      if (comingSoon) {
        onChange(!checked);
      }
      return;
    }
    onChange(!checked);
  };

  return (
    <div
      className={`flex items-center justify-between py-3 ${
        comingSoon ? "opacity-80" : ""
      } ${className}`}
    >
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor={id}
            className={`block text-sm font-semibold ${
              isDisabled
                ? "text-content-secondary cursor-not-allowed"
                : "text-content-primary cursor-pointer"
            }`}
          >
            {label}
          </label>
          {comingSoon && (
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-200 rounded-full">
              Coming Soon
            </span>
          )}
        </div>
        <p className="text-xs text-content-secondary mt-0.5 leading-normal">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={comingSoon ? false : checked}
        aria-disabled={isDisabled ? "true" : undefined}
        aria-label={label}
        disabled={disabled && !comingSoon}
        onClick={handleClick}
        title={comingSoon ? `${label} — Coming soon` : undefined}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
          comingSoon
            ? "bg-surface-emphasis cursor-not-allowed opacity-60"
            : isDisabled
              ? "bg-surface-muted cursor-not-allowed opacity-60"
              : checked
                ? "bg-brand-600 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                : "bg-content-muted cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
            !comingSoon && checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
};
