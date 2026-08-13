import type * as React from "react";
import type { IconProps } from "./types";

export const TargetArrowIcon: React.FC<IconProps> = ({
  size = 14,
  className = "",
  fill = "currentColor",
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
    <path
      fill={fill}
      fillRule="evenodd"
      d="M11.133.018a.5.5 0 0 1 .352.36l.427 1.71 1.71.427a.5.5 0 0 1 .231.839l-2 2a.5.5 0 0 1-.474.131L9.795 5.09 7.442 7.442a.625.625 0 1 1-.884-.884L8.91 4.205l-.396-1.584a.5.5 0 0 1 .131-.475l2-2a.5.5 0 0 1 .487-.128Zm-4.53 1.26A.625.625 0 1 0 6.518.03a6.97 6.97 0 1 0 7.432 7.507.625.625 0 0 0-1.246-.1 5.721 5.721 0 1 1-6.1-6.16Zm-.095 2.77a.625.625 0 0 1-.354.81 2.304 2.304 0 1 0 2.987 2.98.625.625 0 0 1 1.165.452 3.555 3.555 0 1 1-4.608-4.596.625.625 0 0 1 .81.354Z"
      clipRule="evenodd"
    />
  </svg>
);
