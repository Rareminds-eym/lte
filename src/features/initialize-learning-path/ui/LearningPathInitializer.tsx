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
  const searchParamsString = searchParams.toString();
  const navigate = useNavigate();
  const initializationStartedRef = useRef(false);
  const lastParamsRef = useRef<string | null>(null);

  const { accessToken, loading: authLoading, initialized: authInitialized } = useAuthStore();

  const { mutate, isPending } = useInitializeLearningPath();

  // Parse parameters from query string
  const parsedParams = useMemo(() => {
    const params = new URLSearchParams(searchParamsString);
    const fit = params.get("fit");
    const track = params.get("track");
    const matchScore = params.get("matchScore");
    const attemptId = params.get("attemptId");
    const roleId = params.get("roleId");
    const duration = params.get("duration");

    // If none of the main params exist, we are not trying to initialize
    if (!fit && !track && !matchScore && !attemptId && !roleId) {
      return null;
    }

    return initializeLearningPathSchema.safeParse({
      fit,
      track,
      matchScore,
      whyItFits: params.get("whyItFits") ?? "",
      attemptId,
      roleId,
      duration: duration || undefined,
    });
  }, [searchParamsString]);

  const cleanUrl = useCallback(() => {
    navigate(`/my-courses/${encodeURIComponent(capabilityCode)}`, {
      replace: true,
    });
  }, [capabilityCode, navigate]);

  useEffect(() => {
    if (searchParamsString !== lastParamsRef.current) {
      initializationStartedRef.current = false;
      lastParamsRef.current = searchParamsString;
    }

    if (
      parsedParams === null ||
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
      const errorMessage = firstIssue?.path
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

    mutate(
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
    mutate,
    capabilityCode,
    navigate,
    cleanUrl,
    searchParamsString,
  ]);

  if (isPending) {
    return <PageLoader message="Initializing learning path..." />;
  }

  return null;
};
