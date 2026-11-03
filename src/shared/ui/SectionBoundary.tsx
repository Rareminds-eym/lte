import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { getLogger, UI_TEXT } from "@/shared/config";
import { Button } from "./Button";

export interface SectionBoundaryProps {
  label: string;
  children: ReactNode;
}

export function SectionBoundary({ label, children }: SectionBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error, info) =>
        getLogger("SectionBoundary").error("Section rendering failed", {
          error,
          componentStack: info.componentStack,
          section: label,
        })
      }
      fallbackRender={({ resetErrorBoundary }) => (
        <section
          role="alert"
          aria-label={label}
          className="rounded-2xl border border-line-default bg-surface-primary p-6 space-y-3"
        >
          <h2 className="font-semibold text-content-primary">
            {UI_TEXT.sectionUnavailable(label)}
          </h2>
          <p className="text-sm text-content-secondary">{UI_TEXT.sectionRetryDescription}</p>
          <Button size="sm" onClick={resetErrorBoundary}>
            {UI_TEXT.retry}
          </Button>
        </section>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
