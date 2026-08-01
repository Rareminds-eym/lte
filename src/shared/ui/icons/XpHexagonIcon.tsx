import type React from "react";
import type { IconProps } from "./types";

export const XpHexagonIcon: React.FC<IconProps> = ({ size = 80, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon
        points="50,6 88,28 88,72 50,94 12,72 12,28"
        fill="url(#xpHexagonOuterGrad)"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polygon
        points="50,14 81,32 81,68 50,86 19,68 19,32"
        fill="url(#xpHexagonInnerGrad)"
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <text
        x="50"
        y="58"
        fill="#FFFFFF"
        fontSize="22"
        fontWeight="900"
        textAnchor="middle"
        fontFamily="Outfit, Inter, system-ui, sans-serif"
        letterSpacing="0.5"
      >
        XP
      </text>

      <defs>
        <linearGradient
          id="xpHexagonOuterGrad"
          x1="50"
          y1="6"
          x2="50"
          y2="94"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#15b780" />
          <stop offset="100%" stopColor="#086e4e" />
        </linearGradient>
        <linearGradient
          id="xpHexagonInnerGrad"
          x1="50"
          y1="14"
          x2="50"
          y2="86"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#3cdba3" />
          <stop offset="100%" stopColor="#149b6d" />
        </linearGradient>
      </defs>
    </svg>
  );
};
