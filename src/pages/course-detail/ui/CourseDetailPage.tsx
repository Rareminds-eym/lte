import type React from "react";
import { useLocation, useParams } from "react-router-dom";
import { LearningPathInitializer } from "@/features/initialize-learning-path";

export const CourseDetailPage: React.FC = () => {
  const { capabilityCode } = useParams<{ capabilityCode: string }>();
  const location = useLocation();
  // Read error from router state passed on redirect
  const state = location.state as Record<string, unknown> | null;
  const initError =
    typeof state?.["initializationError"] === "string" ? state["initializationError"] : undefined;

  if (!capabilityCode) {
    return (
      <div role="alert" className="p-8 text-red-600 font-semibold">
        Invalid course URL.
      </div>
    );
  }

  return (
    <>
      <LearningPathInitializer capabilityCode={capabilityCode} />

      <main className="p-4 md:p-8" data-testid="course-detail-page">
        <h1 className="text-2xl font-bold text-content-primary">Course Details</h1>

        {initError && (
          <div
            className="mt-4 p-4 bg-red-50 text-red-700 rounded-md border border-red-200"
            data-testid="init-error-message"
          >
            <p className="font-semibold">Initialization Error:</p>
            <p className="text-sm">{initError}</p>
          </div>
        )}

        <p className="mt-2 text-content-secondary">
          Capability Code:{" "}
          <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-brand-600">
            {capabilityCode}
          </span>
        </p>
      </main>
    </>
  );
};
