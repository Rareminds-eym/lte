import type React from "react";
import type { IconProps } from "./types";

export const TrendingArrowIcon: React.FC<IconProps> = ({ size = 16, className = "", ...props }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    className={className}
    {...props}
  >
    <path
      d="M9.33301 4.0835H12.833V7.5835"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.16667"
    />
    <path
      d="M12.8337 4.0835L7.87533 9.04183L4.95866 6.12516L1.16699 9.91683"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.16667"
    />
  </svg>
);
