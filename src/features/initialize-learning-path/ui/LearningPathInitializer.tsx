import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/app/store/authStore";
import { PageLoader } from "@/shared/ui";
import { initializeLearningPathSchema } from "../model/initializeLearningPath.schema";
import { useInitializeLearningPath } from "../model/useInitializeLearningPath";

type LearningPathInitializerProps = {
  capabilityCode: string;
};

export const LearningPathInitializer = ({ capabilityCode }: LearningPathInitializerProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initializationStartedRef = useRef(false);

  const { accessToken, loading: authLoading, initialized: authInitialized } = useAuthStore();

  const mutation = useInitializeLearningPath();

  // Parse parameters from query string
  const parsedParams = useMemo(() => {
    const fit = searchParams.get("fit");
    const track = searchParams.get("track");
    const matchScore = searchParams.get("matchScore");
    const attemptId = searchParams.get("attemptId");
    const roleId = searchParams.get("roleId");

    // If none of the main params exist, we are not trying to initialize
    if (!fit && !track && !matchScore && !attemptId && !roleId) {
      return null;
    }

    return initializeLearningPathSchema.safeParse({
      fit,
      track,
      matchScore,
      whyItFits: searchParams.get("whyItFits") ?? "",
      attemptId,
      roleId,
    });
  }, [searchParams]);

  const cleanUrl = useCallback(() => {
    navigate(`/my-courses/${encodeURIComponent(capabilityCode)}`, {
      replace: true,
    });
  }, [capabilityCode, navigate]);

  useEffect(() => {
    if (
      !parsedParams ||
      authLoading ||
      !authInitialized ||
      !accessToken ||
      initializationStartedRef.current
    ) {
      return;
    }

    initializationStartedRef.current = true;

    if (!parsedParams.success) {
      // If validation fails, clean URL and pass validation error
      const firstIssue = parsedParams.error.issues[0];
      const errorMessage = firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid initialization parameters.";

      navigate(`/my-courses/${encodeURIComponent(capabilityCode)}`, {
        replace: true,
        state: {
          initializationError: errorMessage,
        },
      });
      return;
    }

    mutation.mutate(
      {
        payload: parsedParams.data,
        accessToken,
      },
      {
        onSuccess: () => {
          cleanUrl();
        },
        onError: (error) => {
          navigate(`/my-courses/${encodeURIComponent(capabilityCode)}`, {
            replace: true,
            state: {
              initializationError: error.message,
            },
          });
        },
      },
    );
  }, [
    parsedParams,
    authLoading,
    authInitialized,
    accessToken,
    mutation,
    capabilityCode,
    navigate,
    cleanUrl,
  ]);

  if (mutation.isPending) {
    return <PageLoader message="Initializing learning path..." />;
  }

  return null;
};
