import type React from "react";
import { getSkillpassportUrl } from "@/shared/config";
import { Button } from "@/shared/ui";

interface StartAssessmentButtonProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline" | "ghost";
  children?: React.ReactNode;
}

export const StartAssessmentButton: React.FC<StartAssessmentButtonProps> = ({
  className,
  size = "md",
  variant = "primary",
  children,
}) => {
  const handleStart = () => {
    const origin = window.location.origin;
    const skillUrl = getSkillpassportUrl();
    const redirectUri = encodeURIComponent(`${origin}/my-courses`);
    const targetUrl = `${skillUrl}/assessment?source=lte&target_app=lte&redirect_uri=${redirectUri}`;
    window.location.href = targetUrl;
  };

  return (
    <Button type="button" onClick={handleStart} size={size} variant={variant} className={className}>
      {children || "Take Assessment"}
    </Button>
  );
};
