import type * as React from "react";
import type { IconProps } from "./types";

export const ArrowRightIcon: React.FC<IconProps> = ({
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
    viewBox="0 0 24 24"
    stroke={stroke}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

export default ArrowRightIcon;
