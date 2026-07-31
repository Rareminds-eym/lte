import type React from "react";
import type { IconProps } from "./types";

export const CodeBracketsIcon: React.FC<IconProps> = ({ size = 16, className = "", ...props }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    className={className}
    {...props}
  >
    <path
      d="M10.5 9.33317L12.8333 6.99984L10.5 4.6665"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.16667"
    />
    <path
      d="M3.50033 4.6665L1.16699 6.99984L3.50033 9.33317"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.16667"
    />
    <path
      d="M8.45866 2.3335L5.54199 11.6668"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.16667"
    />
  </svg>
);
