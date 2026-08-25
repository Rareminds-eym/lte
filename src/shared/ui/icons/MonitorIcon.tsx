import type * as React from "react";
import type { IconProps } from "./types";

export const MonitorIcon: React.FC<IconProps> = ({
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
      d="M8.5 5.666V2.833H5.665M12.75 5.667h-8.5c-.782 0-1.416.634-1.416 1.417v5.666c0 .783.634 1.417 1.417 1.417h8.5c.782 0 1.416-.634 1.416-1.417V7.084c0-.783-.634-1.417-1.416-1.417ZM1.416 9.917h1.417M14.166 9.917h1.417M10.625 9.208v1.417M6.375 9.208v1.417"
    />
  </svg>
);
