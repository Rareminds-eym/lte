import React from "react";
import { cn } from "@/shared/lib";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const baseInputStyles =
  "w-full px-3.5 py-2.5 text-sm text-content-primary bg-white border border-line-default rounded-lg placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow";

const readOnlyInputStyles =
  "w-full px-3.5 py-2.5 text-sm text-content-secondary bg-surface-secondary border border-line-default rounded-lg cursor-not-allowed";

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ id, label, readOnly, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-xs font-semibold text-content-primary mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          readOnly={readOnly}
          className={cn(readOnly ? readOnlyInputStyles : baseInputStyles, className)}
          {...props}
        />
      </div>
    );
  },
);

TextField.displayName = "TextField";
