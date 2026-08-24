import type * as React from "react";
import type { IconProps } from "./types";

export const SlidersIcon: React.FC<IconProps> = ({
  size = 16,
  className = "",
  stroke = "currentColor",
  ...props
}) => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill="none"
    viewBox="0 0 16 16"
    className={className}
    {...props}
  >
    <path
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.333}
      d="M13.334 4.667h-6M9.334 11.334h-6M11.334 13.334a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4.666 6.667a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
    />
  </svg>
);
