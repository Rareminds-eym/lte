import type * as React from "react";
import type { IconProps } from "./types";

export const InfoCircleIcon: React.FC<IconProps> = ({
  size = 13,
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
    viewBox="0 0 13 13"
    className={className}
    {...props}
  >
    <path
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.083}
      d="M6.5 11.916a5.417 5.417 0 1 0 0-10.833 5.417 5.417 0 0 0 0 10.833ZM6.5 8.667V6.5M6.5 4.333h.005"
    />
  </svg>
);

export default InfoCircleIcon;
