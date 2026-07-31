import type React from "react";
import type { IconProps } from "./types";

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, className = "", ...props }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    className={className}
    {...props}
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
