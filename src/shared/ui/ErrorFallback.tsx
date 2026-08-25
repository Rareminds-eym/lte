import type React from "react";
import type { FallbackProps } from "react-error-boundary";
import { Button } from "./Button";

export const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="p-8 text-center">
      <h1>Something went wrong</h1>
      <p className="text-rose-500 my-4">{errorMessage}</p>
      <Button variant="primary" size="md" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
};
