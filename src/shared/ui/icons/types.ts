import type React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export interface TogglePanelIconProps extends IconProps {
  isActive?: boolean;
}
