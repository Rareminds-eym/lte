import type * as React from "react";
import type { IconProps } from "./types";

export const ConcentricTargetIcon: React.FC<IconProps> = ({
  size = 14,
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
    viewBox="0 0 14 14"
    className={className}
    {...props}
  >
    <g
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.167}
      clipPath="url(#concentric_target_clip)"
    >
      <path d="M7 12.833A5.833 5.833 0 1 0 7 1.166a5.833 5.833 0 0 0 0 11.667Z" />
      <path d="M7 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M7 8.167a1.167 1.167 0 1 0 0-2.334 1.167 1.167 0 0 0 0 2.334Z" />
    </g>
    <defs>
      <clipPath id="concentric_target_clip">
        <path fill="#fff" d="M0 0h14v14H0z" />
      </clipPath>
    </defs>
  </svg>
);

export default ConcentricTargetIcon;
