import type React from "react";
import { getSkillpassportUrl } from "@/shared/config";
import { getLogger } from "@/shared/config/logging";
import { Button, toast } from "@/shared/ui";

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
    try {
      const origin = window.location.origin;
      const skillUrl = getSkillpassportUrl();
      const redirectUri = encodeURIComponent(`${origin}/my-courses`);
      const targetUrl = `${skillUrl}/assessment?source=lte&target_app=lte&redirect_uri=${redirectUri}`;
      window.location.href = targetUrl;
    } catch (err) {
      getLogger("StartAssessment").error("Failed to resolve SkillPassport URL", err);
      toast.error("Unable to start assessment: service configuration is missing.");
    }
  };

  return (
    <Button type="button" onClick={handleStart} size={size} variant={variant} className={className}>
      {children || "Take Assessment"}
    </Button>
  );
};
