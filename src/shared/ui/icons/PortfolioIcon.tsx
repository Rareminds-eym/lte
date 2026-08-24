import type * as React from "react";
import type { IconProps } from "./types";

export const PortfolioIcon: React.FC<IconProps> = ({
  size = 17,
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
    viewBox="0 0 17 17"
    className={className}
    {...props}
  >
    <path
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.417}
      d="M14.166 4.958H2.833c-.783 0-1.417.634-1.417 1.417v7.083c0 .782.634 1.417 1.417 1.417h11.333c.782 0 1.417-.635 1.417-1.417V6.375c0-.783-.635-1.417-1.417-1.417Z"
    />
    <path
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.417}
      d="M11.333 14.875V3.542a1.417 1.417 0 0 0-1.417-1.417H7.083a1.417 1.417 0 0 0-1.417 1.417v11.333"
    />
  </svg>
);
