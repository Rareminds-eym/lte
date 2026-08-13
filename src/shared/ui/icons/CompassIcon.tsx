import type * as React from "react";
import type { IconProps } from "./types";

export const CompassIcon: React.FC<IconProps> = ({
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
      d="M8 14.666A6.667 6.667 0 1 0 8 1.333a6.667 6.667 0 0 0 0 13.333Z"
    />
    <path
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.333}
      d="m10.827 5.173-1.413 4.24-4.24 1.413 1.413-4.24 4.24-1.413Z"
    />
  </svg>
);
