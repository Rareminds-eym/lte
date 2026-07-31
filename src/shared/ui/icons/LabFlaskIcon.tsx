import type React from "react";
import type { IconProps } from "./types";

export const LabFlaskIcon: React.FC<IconProps> = ({ size = 16, className = "", ...props }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    className={className}
    {...props}
  >
    <path d="M10 2v7.31L4.75 20.5a1 1 0 0 0 .85 1.5h12.8a1 1 0 0 0 .85-1.5L14 9.31V2" />
    <path d="M8.5 2h7" />
  </svg>
);
