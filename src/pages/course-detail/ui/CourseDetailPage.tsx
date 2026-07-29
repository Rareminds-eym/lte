import type React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useLocation, useParams } from "react-router-dom";
import { LearningPathInitializer } from "@/features/initialize-learning-path";
import { ErrorFallback } from "@/shared/ui";

interface InitErrorState {
  initializationError: string;
}

const hasInitError = (state: unknown): state is InitErrorState => {
  return (
    typeof state === "object" &&
    state !== null &&
    "initializationError" in state &&
    typeof (state as { initializationError: unknown })["initializationError"] === "string"
  );
};

export const CourseDetailPage: React.FC = () => {
  const { capabilityCode } = useParams<{ capabilityCode: string }>();
  const location = useLocation();

  const initError = hasInitError(location.state) ? location.state.initializationError : undefined;

  if (!capabilityCode) {
    return (
      <section role="alert" aria-live="assertive" className="p-8 text-red-600 font-semibold">
        Invalid course URL.
      </section>
    );
  }

  return (
    <main className="p-4 md:p-8" data-testid="course-detail-page">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <LearningPathInitializer capabilityCode={capabilityCode} />
      </ErrorBoundary>

      <h1 className="text-2xl font-bold text-content-primary">Course Details</h1>

      {initError && (
        <section
          role="alert"
          aria-live="assertive"
          className="mt-4 p-4 bg-red-50 text-red-700 rounded-md border border-red-200"
          data-testid="init-error-message"
        >
          <p className="font-semibold">Initialization Error:</p>
          <p className="text-sm">{initError}</p>
        </section>
      )}

      <p className="mt-2 text-content-secondary">
        Capability Code:{" "}
        <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-brand-600">
          {capabilityCode}
        </span>
      </p>
    </main>
  );
};
