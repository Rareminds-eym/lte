import type React from "react";
import { Toaster as HotToaster } from "react-hot-toast";

/**
 * Branded Toaster component configured with the LTE theme styles.
 * Mount this component once at the root level of the application.
 */
export const Toaster: React.FC = () => {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        // Visual Styling using LTE design tokens
        style: {
          background: "var(--color-surface-primary, #ffffff)",
          color: "var(--color-content-primary, #111827)",
          fontFamily: "var(--font-sans)",
          fontSize: "0.875rem",
          fontWeight: 500,
          borderRadius: "0.75rem",
          border: "1px solid var(--color-border-default, #e5e7eb)",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          padding: "0.75rem 1rem",
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: "var(--color-success-500, #10b981)",
            secondary: "var(--color-surface-primary, #ffffff)",
          },
        },
        error: {
          duration: 4000,
          iconTheme: {
            primary: "var(--color-warning-700, #b45309)", // Red/warning theme
            secondary: "var(--color-surface-primary, #ffffff)",
          },
        },
      }}
    />
  );
};
