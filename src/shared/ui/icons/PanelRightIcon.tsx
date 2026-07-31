import type React from "react";
import type { TogglePanelIconProps } from "./types";

export const PanelRightIcon: React.FC<TogglePanelIconProps> = ({
  size = 16,
  className = "",
  isActive = false,
  ...props
}) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.75"
    className={className}
    {...props}
  >
    <rect width="18" height="18" x="3" y="3" rx="4" />
    <line x1="15" x2="15" y1="3" y2="21" />
    {isActive && (
      <rect
        width="6"
        height="18"
        x="15"
        y="3"
        rx="4"
        fill="currentColor"
        opacity="0.3"
        stroke="none"
      />
    )}
  </svg>
);
