import type React from "react";
import type { IconProps } from "./types";

export const BeakerIcon: React.FC<IconProps> = ({ size = 16, className = "", ...props }) => (
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
      d="M8.16661 1.1665V4.6665C8.16653 4.8622 8.21568 5.05478 8.30953 5.2265L11.5237 11.1065C11.6209 11.2842 11.6702 11.4841 11.6667 11.6866C11.6632 11.8892 11.607 12.0873 11.5038 12.2615C11.4005 12.4357 11.2536 12.5801 11.0776 12.6803C10.9016 12.7805 10.7025 12.8332 10.4999 12.8332H3.49994C3.2974 12.8332 3.09833 12.7805 2.92232 12.6803C2.74632 12.5801 2.59944 12.4357 2.49614 12.2615C2.39284 12.0873 2.33668 11.8892 2.33318 11.6866C2.32968 11.4841 2.37897 11.2842 2.47619 11.1065L5.69036 5.2265C5.78421 5.05478 5.83336 4.8622 5.83328 4.6665V1.1665"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.16667"
    />
    <path
      d="M3.76465 8.75H10.2361"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.16667"
    />
    <path
      d="M4.95801 1.1665H9.04134"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.16667"
    />
  </svg>
);
