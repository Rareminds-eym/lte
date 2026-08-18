import type * as React from "react";
import type { IconProps } from "./types";

export const GraduationCapIcon: React.FC<IconProps> = ({
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
      d="M15.173 7.736a.708.708 0 0 0-.014-1.302L9.09 3.67a1.417 1.417 0 0 0-1.176 0L1.843 6.43a.708.708 0 0 0 0 1.298l6.07 2.768a1.417 1.417 0 0 0 1.175 0l6.085-2.761ZM15.584 7.083v4.25"
    />
    <path
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.417}
      d="M4.25 8.854v2.48c0 .563.448 1.104 1.245 1.502.797.399 1.878.623 3.005.623s2.208-.224 3.005-.623c.797-.398 1.245-.939 1.245-1.502v-2.48"
    />
  </svg>
);
