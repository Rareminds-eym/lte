import type * as React from "react";
import type { IconProps } from "./types";

export const CalendarIcon: React.FC<IconProps> = ({
  size = 10,
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
    viewBox="0 0 10 10"
    className={className}
    {...props}
  >
    <g
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={0.833}
      clipPath="url(#calendar_clip)"
    >
      <path d="M3.334.833V2.5M6.666.833V2.5M7.917 1.667H2.083a.833.833 0 0 0-.833.833v5.834c0 .46.373.833.833.833h5.834c.46 0 .833-.373.833-.833V2.5a.833.833 0 0 0-.833-.833ZM1.25 4.167h7.5" />
    </g>
    <defs>
      <clipPath id="calendar_clip">
        <path fill="#fff" d="M0 0h10v10H0z" />
      </clipPath>
    </defs>
  </svg>
);

export default CalendarIcon;
