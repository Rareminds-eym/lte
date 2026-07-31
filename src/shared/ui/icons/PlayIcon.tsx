import type React from "react";
import type { IconProps } from "./types";

export const PlayIcon: React.FC<IconProps> = ({ size = 16, className = "", ...props }) => (
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
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
