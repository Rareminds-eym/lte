import type * as React from "react";
import type { IconProps } from "./types";

export const TrophyIcon: React.FC<IconProps> = ({
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
      d="M4.25 6.375H3.186a1.77 1.77 0 0 1 0-3.542h1.062M12.75 6.375h1.063a1.77 1.77 0 1 0 0-3.542H12.75M2.834 15.584h11.333M7.084 10.384v1.658c0 .39-.333.694-.687.857-.836.382-1.438 1.438-1.438 2.684M9.916 10.384v1.658c0 .39.333.694.687.857.836.382 1.438 1.438 1.438 2.684"
    />
    <path
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.417}
      d="M12.75 1.417h-8.5v4.958a4.25 4.25 0 0 0 8.5 0V1.417Z"
    />
  </svg>
);

export default TrophyIcon;
