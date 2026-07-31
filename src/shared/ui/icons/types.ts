import type React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export interface TogglePanelIconProps extends IconProps {
  isActive?: boolean;
}
