import type * as React from "react";
import type { IconProps } from "./types";

export const BrainIcon: React.FC<IconProps> = ({
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
    <g
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.083}
      clipPath="url(#brain_clip_path)"
    >
      <path d="M6.5 2.708a1.625 1.625 0 1 0-3.25.068 2.167 2.167 0 0 0-1.367 3.126 2.166 2.166 0 0 0 .3 3.568 2.166 2.166 0 1 0 4.316.28V2.708Z" />
      <path d="M6.5 2.708a1.625 1.625 0 1 1 3.248.068 2.167 2.167 0 0 1 1.369 3.126 2.166 2.166 0 0 1-.302 3.568 2.167 2.167 0 1 1-4.315.28V2.708Z" />
      <path d="M8.125 7.042A2.438 2.438 0 0 1 6.5 4.875a2.438 2.438 0 0 1-1.625 2.167M9.533 3.52c.131-.227.205-.482.216-.744M3.252 2.776c.01.262.085.517.216.745M1.883 5.902c.099-.08.205-.152.317-.215M10.799 5.688c.112.062.218.133.317.214M3.249 9.75c-.373 0-.74-.096-1.065-.28M10.816 9.47c-.326.184-.693.28-1.066.28" />
    </g>
    <defs>
      <clipPath id="brain_clip_path">
        <path fill="#fff" d="M0 0h13v13H0z" />
      </clipPath>
    </defs>
  </svg>
);
