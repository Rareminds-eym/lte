import type React from "react";
import type { FallbackProps } from "react-error-boundary";

export const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Something went wrong</h1>
      <p style={{ color: "#ef4444", margin: "1rem 0" }}>{errorMessage}</p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "0.375rem",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
};
