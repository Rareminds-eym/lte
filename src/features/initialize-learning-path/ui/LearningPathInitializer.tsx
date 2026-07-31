import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ZodIssue } from "zod";
import { useLearningPathStore } from "@/entities/active-learning-path";
import { useAuthStore } from "@/entities/session";
import { initializeLearningPathSchema } from "../model/initializeLearningPath.schema";
import { useInitializeLearningPath } from "../model/useInitializeLearningPath";

type LearningPathInitializerProps = {
  capabilityCode: string;
};

const buildCourseDetailUrl = (code: string) => `/my-courses/${encodeURIComponent(code)}`;

const formatZodIssue = (issue: ZodIssue | undefined): string => {
  if (!issue) return "Invalid initialization parameters.";
  const pathStr = issue.path.join(".");
  return pathStr ? `${pathStr}: ${issue.message}` : issue.message;
};

export const LearningPathInitializer = ({ capabilityCode }: LearningPathInitializerProps) => {
  const [searchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const navigate = useNavigate();
  const initializationStartedRef = useRef(false);
  const lastParamsRef = useRef<string | null>(null);

  const authLoading = useAuthStore((s) => s.loading);
  const authInitialized = useAuthStore((s) => s.initialized);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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

  useEffect(() => {
    // Determine if search parameters changed
    const paramsChanged = searchParamsString !== lastParamsRef.current;

    // Check if we should skip initialization
    if (parsedParams === null || authLoading || !authInitialized || !isAuthenticated) {
      if (paramsChanged) {
        lastParamsRef.current = searchParamsString;
        initializationStartedRef.current = false;
      }
      return;
    }

    // If params changed, reset state to allow a new initialization cycle
    if (paramsChanged) {
      initializationStartedRef.current = false;
      lastParamsRef.current = searchParamsString;
    }

    // Guard against duplicate mutations for the same parameters
    if (initializationStartedRef.current) {
      return;
    }

    initializationStartedRef.current = true;

    if (!parsedParams.success) {
      // If validation fails, clean URL and pass validation error
      const firstIssue = parsedParams.error.issues[0];
      const errorMessage = formatZodIssue(firstIssue);

      navigate(buildCourseDetailUrl(capabilityCode), {
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
      },
      {
        onSuccess: async () => {
          await useLearningPathStore.getState().fetchAndSetActiveLearningPath();
          navigate(buildCourseDetailUrl(capabilityCode), {
            replace: true,
          });
        },
        onError: (error) => {
          navigate(buildCourseDetailUrl(capabilityCode), {
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
    isAuthenticated,
    mutate,
    capabilityCode,
    navigate,
    searchParamsString,
  ]);

  if (isPending) {
    return (
      <div
        className="bg-surface-primary border border-line-default rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto shadow-sm animate-pulse mb-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-200 border-t-brand-600" />
        <div>
          <p className="text-sm font-semibold text-content-primary">
            Initializing learning path...
          </p>
          <p className="text-xs text-content-secondary mt-1">
            Please wait while we provision your course progress state.
          </p>
        </div>
      </div>
    );
  }

  return null;
};
