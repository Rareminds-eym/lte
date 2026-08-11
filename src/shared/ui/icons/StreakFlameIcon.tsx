import type React from "react";
import type { IconProps } from "./types";

export const StreakFlameIcon: React.FC<IconProps> = ({ size = 24, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M39.8 4.5c.6 8.7 3.5 14.9 9.3 22 4.7 5.7 7 11 7 17.4C56.1 54 47.1 61 32.7 61 18.5 61 8 52.1 8 40.2c0-9.8 5.8-17.2 14.9-23.7-.6 6 1.6 10.4 6.8 13.3-.2-11 3.4-19.7 10.1-25.3Z"
        fill="url(#streakFlameOuter)"
      />
      <path
        d="M38.3 33.2c3.7 4.1 6 7.6 6 12.5 0 6.3-5.2 10.8-12.1 10.8-7.3 0-12.4-4.9-12.4-11.2 0-4.6 2.5-8.1 6.5-11.2.4 3.7 2.1 6.1 5.1 7.5.2-5.7 2.4-8.9 6.9-8.4Z"
        fill="url(#streakFlameInner)"
      />
      <path
        d="M23 16.5c-.6 6 1.6 10.4 6.8 13.3-.2-11 3.4-19.7 10.1-25.3.2 2.9.7 5.5 1.5 7.9"
        stroke="#F97316"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient
          id="streakFlameOuter"
          x1="32.1"
          x2="32.1"
          y1="4.5"
          y2="61"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FB7185" />
          <stop offset="0.48" stopColor="#F97316" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient
          id="streakFlameInner"
          x1="32.1"
          x2="32.1"
          y1="33"
          y2="56.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FEF08A" />
          <stop offset="1" stopColor="#FACC15" />
        </linearGradient>
      </defs>
    </svg>
  );
};
